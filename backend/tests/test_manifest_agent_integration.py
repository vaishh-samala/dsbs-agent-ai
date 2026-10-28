"""Integration tests verifying manifest discovery, loading, and LangGraph agent orchestration."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import yaml

from app.agent.graph import resume_sandbox_agent, run_sandbox_agent
from app.main import app
from app.services.workflow_service import workflow_service


client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_workflow_store():
    """Ensure in-memory store is clean between test runs."""
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


def test_agent_orchestrates_discovered_yaml_manifest(tmp_path: Path):
    """Verify that a repository with sandbox.manifest.yaml is discovered, validated, and run by the agent."""
    manifest_data = {
        "version": "1.0",
        "project_name": "agent-discovered-service",
        "project_type": "fastapi_service",
        "runtime": "python",
        "language": "python",
        "runtime_version": "3.11.9",
        "package_manager": "poetry",
        "dependencies": ["fastapi>=0.111.0", "uvicorn>=0.29.0"],
        "env_var_names": ["PORT", "DATABASE_URL"],
        "setup_commands": ["poetry install --no-root"],
        "validation_commands": ["poetry run pytest"],
        "port": 8000,
        "start_command": "poetry run uvicorn main:app --port 8000",
        "test_command": "poetry run pytest",
    }
    manifest_file = tmp_path / "sandbox.manifest.yaml"
    manifest_file.write_text(yaml.dump(manifest_data), encoding="utf-8")

    # Pass repo_path to agent: pauses at approval gate
    initial_state = run_sandbox_agent({"repo_path": str(tmp_path)}, workflow_id="wf-agent-discover-01")

    assert initial_state["workflow_id"] == "wf-agent-discover-01"
    assert initial_state["status"] == "awaiting_approval"
    assert initial_state["approval_status"] == "awaiting_approval"

    # Validation result
    val_res = initial_state["validation_result"]
    assert val_res["is_valid"] is True
    assert val_res["normalized_manifest"]["project_name"] == "agent-discovered-service"
    assert val_res["normalized_manifest"]["version"] == "1.0"
    assert val_res["normalized_manifest"]["language"] == "python"

    # Execution plan uses manifest setup commands
    plan = initial_state["execution_plan"]
    assert len(plan) == 2
    assert plan[0]["name"] == "prepare_environment"
    assert plan[1]["name"] == "resolve_dependencies"
    assert plan[1]["commands"] == ["poetry install --no-root"]

    # Resume with approval
    state = resume_sandbox_agent("wf-agent-discover-01", approved=True)

    assert state["workflow_id"] == "wf-agent-discover-01"
    assert state["status"] == "completed"
    assert state["current_step"] == "finalize_workflow"
    assert len(state["errors"]) == 0

    # All pipeline steps completed
    step_statuses = state["step_statuses"]
    assert len(step_statuses) == 5  # validate_manifest, approval_gate, prepare_environment, resolve_dependencies, run_health_checks
    for step_name in ["validate_manifest", "approval_gate", "prepare_environment", "resolve_dependencies", "run_health_checks"]:
        assert step_statuses[step_name]["status"] == "completed"

    # Summary includes manifest version and command counts
    summary = state["final_summary"]
    assert summary["status"] == "completed"
    manifest_summary = summary["manifest_summary"]
    assert manifest_summary["version"] == "1.0"
    assert manifest_summary["setup_commands_count"] == 1
    assert manifest_summary["validation_commands_count"] == 1


def test_agent_orchestrates_discovered_json_manifest(tmp_path: Path):
    """Verify that a repository with sandbox.manifest.json for Node is discovered, approved, and executed."""
    manifest_data = {
        "version": "1.0",
        "project_name": "agent-node-app",
        "project_type": "nextjs_app",
        "runtime": "node",
        "language": "typescript",
        "runtime_version": "20.14.0",
        "package_manager": "pnpm",
        "dependencies": ["next@14.2.3", "react@18.3.1"],
        "env_var_names": ["PORT", "API_URL"],
        "setup_commands": ["pnpm install"],
        "validation_commands": ["pnpm test"],
        "port": 3000,
        "start_command": "pnpm dev",
        "test_command": "pnpm test",
    }
    manifest_file = tmp_path / "sandbox.manifest.json"
    manifest_file.write_text(json.dumps(manifest_data), encoding="utf-8")

    initial_state = run_sandbox_agent({"repo_path": str(tmp_path)}, workflow_id="wf-agent-node-01")
    assert initial_state["status"] == "awaiting_approval"

    state = resume_sandbox_agent("wf-agent-node-01", approved=True)

    assert state["status"] == "completed"
    assert state["validation_result"]["is_valid"] is True
    assert state["validation_result"]["normalized_manifest"]["language"] == "typescript"
    assert state["step_statuses"]["resolve_dependencies"]["status"] == "completed"
    assert state["step_statuses"]["run_health_checks"]["status"] == "completed"


def test_agent_orchestrates_pyproject_inference_fallback(tmp_path: Path):
    """Verify that the agent automatically infers configuration from pyproject.toml when no manifest exists."""
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text(
        """
[tool.poetry]
name = "inferred-poetry-api"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111.0"
        """,
        encoding="utf-8",
    )

    initial_state = run_sandbox_agent({"repo_path": str(tmp_path)}, workflow_id="wf-agent-inferred-01")
    assert initial_state["status"] == "awaiting_approval"

    state = resume_sandbox_agent("wf-agent-inferred-01", approved=True)

    assert state["status"] == "completed"
    assert state["validation_result"]["is_valid"] is True
    manifest = state["validation_result"]["normalized_manifest"]
    assert manifest["project_type"] == "fastapi_service"
    assert manifest["package_manager"] == "poetry"
    assert manifest["runtime"] == "python"
    assert state["step_statuses"]["resolve_dependencies"]["status"] == "completed"


def test_agent_orchestrates_unconfigured_empty_repo_fallback(tmp_path: Path):
    """Verify that an empty repository receives a clean fallback, requires approval, and finishes orchestration."""
    empty_repo = tmp_path / "empty_service"
    empty_repo.mkdir()

    initial_state = run_sandbox_agent({"repo_path": str(empty_repo)}, workflow_id="wf-agent-fallback-01")
    assert initial_state["status"] == "awaiting_approval"

    state = resume_sandbox_agent("wf-agent-fallback-01", approved=True)

    assert state["status"] == "completed"
    assert state["validation_result"]["is_valid"] is True
    manifest = state["validation_result"]["normalized_manifest"]
    assert manifest["project_name"] == "empty_service"
    assert manifest["runtime"] == "python"
    assert manifest["runtime_version"] == "3.11.9"


def test_invalid_manifest_in_repo_halts_agent_before_execution(tmp_path: Path):
    """Verify that a manifest with forbidden commands (e.g. sudo) in a repo stops before execution."""
    bad_manifest = {
        "version": "1.0",
        "project_name": "unsafe-repo",
        "project_type": "fastapi_service",
        "runtime": "python",
        "runtime_version": "3.11.9",
        "package_manager": "poetry",
        "setup_commands": ["sudo apt-get install -y evil-pkg"],
    }
    manifest_file = tmp_path / "sandbox.manifest.json"
    manifest_file.write_text(json.dumps(bad_manifest), encoding="utf-8")

    state = run_sandbox_agent({"repo_path": str(tmp_path)}, workflow_id="wf-agent-unsafe-01")

    assert state["status"] == "failed"
    assert state["validation_result"]["is_valid"] is False
    assert len(state["errors"]) > 0
    assert any("privilege escalation" in err for err in state["errors"])

    # Execution nodes were NEVER invoked
    assert state["execution_plan"] == []
    assert "prepare_environment" not in state["step_statuses"]
    assert "resolve_dependencies" not in state["step_statuses"]
    assert "run_health_checks" not in state["step_statuses"]


def test_discover_endpoint_returns_structured_discovery_result(tmp_path: Path):
    """Verify POST /api/v1/sandbox/manifest/discover returns valid ManifestDiscoveryResult."""
    manifest_data = {
        "version": "1.0",
        "project_name": "discovered-api",
        "project_type": "fastapi_service",
        "runtime": "python",
        "runtime_version": "3.11.9",
        "package_manager": "pip",
    }
    manifest_file = tmp_path / "sandbox.manifest.json"
    manifest_file.write_text(json.dumps(manifest_data), encoding="utf-8")

    response = client.post("/api/v1/sandbox/manifest/discover", json={"repo_path": str(tmp_path)})
    assert response.status_code == 200
    data = response.json()

    assert data["discovered"] is True
    assert data["is_fallback"] is False
    assert "sandbox.manifest.json" in data["source"]
    assert data["manifest"]["project_name"] == "discovered-api"
    assert data["manifest"]["version"] == "1.0"
    assert data["manifest"]["runtime"] == "python"

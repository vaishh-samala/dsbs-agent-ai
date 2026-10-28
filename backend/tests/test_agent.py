"""Comprehensive test suite for the LangGraph sandbox bootstrap agent."""

import pytest
from app.agent.graph import run_sandbox_agent, sandbox_agent
from app.agent.state import SandboxAgentState
from app.services.workflow_service import workflow_service


VALID_PYTHON_MANIFEST = {
    "project_name": "agent-fastapi-service",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn[standard]>=0.29.0"],
    "env_var_names": ["PORT", "DATABASE_URL"],
    "port": 8000,
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
    "branch": "main",
}

VALID_NODE_MANIFEST = {
    "project_name": "agent-nextjs-app",
    "project_type": "nextjs_app",
    "runtime": "node",
    "runtime_version": "20.14.0",
    "package_manager": "pnpm",
    "dependencies": ["next@14.2.3", "react@18.3.1"],
    "env_var_names": ["PORT", "API_BASE_URL"],
    "port": 3000,
    "start_command": "pnpm dev",
    "test_command": "pnpm test",
    "branch": "main",
}


@pytest.fixture(autouse=True)
def clean_workflow_store():
    """Ensure in-memory store is clean between test runs."""
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


def test_valid_manifest_successful_graph_run():
    """Verify that a valid manifest executes through all 5 nodes to a completed state."""
    state = run_sandbox_agent(VALID_PYTHON_MANIFEST, workflow_id="wf-agent-test-01")

    # Workflow level assertions
    assert state["workflow_id"] == "wf-agent-test-01"
    assert state["status"] == "completed"
    assert state["current_step"] == "finalize_workflow"
    assert len(state["errors"]) == 0

    # Validation result
    val_res = state["validation_result"]
    assert val_res["is_valid"] is True
    assert val_res["normalized_manifest"]["project_name"] == "agent-fastapi-service"

    # Execution plan formulated in plan_setup
    assert len(state["execution_plan"]) == 2
    plan_names = [p["name"] for p in state["execution_plan"]]
    assert plan_names == ["prepare_environment", "resolve_dependencies"]

    # All 4 pipeline steps tracked and completed
    step_statuses = state["step_statuses"]
    assert len(step_statuses) == 4
    for step_name in ["validate_manifest", "prepare_environment", "resolve_dependencies", "run_health_checks"]:
        assert step_name in step_statuses
        step = step_statuses[step_name]
        assert step["status"] == "completed"
        assert step["started_at"] is not None
        assert step["completed_at"] is not None
        assert step["duration_seconds"] is not None
        assert step["duration_seconds"] > 0
        assert step["error_message"] is None


def test_invalid_manifest_stops_before_execution():
    """Verify that an invalid manifest stops at validate_manifest and never reaches execution."""
    invalid_manifest = {
        "project_name": "invalid project with spaces!",
        "project_type": "fastapi_service",
        "runtime": "python",
        "runtime_version": "3.11",
        "package_manager": "npm",  # Incompatible package manager!
    }

    state = run_sandbox_agent(invalid_manifest, workflow_id="wf-agent-invalid-01")

    # Workflow halts with failed status
    assert state["workflow_id"] == "wf-agent-invalid-01"
    assert state["status"] == "failed"
    assert state["validation_result"]["is_valid"] is False
    assert len(state["errors"]) > 0

    # CRITICAL: Execution plan was NEVER created
    assert state["execution_plan"] == []

    # CRITICAL: Step statuses only contain validate_manifest; execution nodes were NEVER invoked
    assert "validate_manifest" in state["step_statuses"]
    assert state["step_statuses"]["validate_manifest"]["status"] == "failed"
    assert "prepare_environment" not in state["step_statuses"]
    assert "resolve_dependencies" not in state["step_statuses"]
    assert "run_health_checks" not in state["step_statuses"]

    # Final summary reflects failed validation
    summary = state["final_summary"]
    assert summary["status"] == "failed"
    assert summary["failed_steps"] == 1
    assert summary["completed_steps"] == 0


def test_execution_failure_branch_halts_before_verification():
    """Verify that an execution failure halts the workflow and skips verify_setup."""
    exec_fail_manifest = {
        **VALID_PYTHON_MANIFEST,
        "project_name": "sample-fail_exec-service",
    }

    state = run_sandbox_agent(exec_fail_manifest, workflow_id="wf-agent-exec-fail-01")

    # Validation succeeded
    assert state["validation_result"]["is_valid"] is True
    assert len(state["execution_plan"]) == 2

    # Environment prep completed, but dependency resolution failed
    step_statuses = state["step_statuses"]
    assert step_statuses["validate_manifest"]["status"] == "completed"
    assert step_statuses["prepare_environment"]["status"] == "completed"
    assert step_statuses["resolve_dependencies"]["status"] == "failed"
    assert "conflicting lockfile constraints" in step_statuses["resolve_dependencies"]["error_message"]

    # CRITICAL: run_health_checks was SKIPPED / never invoked
    assert "run_health_checks" not in step_statuses

    # Overall state is failed
    assert state["status"] == "failed"
    assert len(state["errors"]) == 1
    assert "Dependency resolution failed" in state["errors"][0]


def test_environment_allocation_failure_branch():
    """Verify that environment allocation failure halts execution immediately."""
    env_fail_manifest = {
        **VALID_PYTHON_MANIFEST,
        "project_name": "sample-fail_env-service",
    }

    state = run_sandbox_agent(env_fail_manifest, workflow_id="wf-agent-env-fail-01")

    # Validation succeeded
    assert state["validation_result"]["is_valid"] is True

    # prepare_environment failed
    step_statuses = state["step_statuses"]
    assert step_statuses["validate_manifest"]["status"] == "completed"
    assert step_statuses["prepare_environment"]["status"] == "failed"
    assert "insufficient sandboxed resource quota" in step_statuses["prepare_environment"]["error_message"]

    # resolve_dependencies marked skipped
    assert step_statuses["resolve_dependencies"]["status"] == "skipped"

    # run_health_checks never invoked
    assert "run_health_checks" not in step_statuses
    assert state["status"] == "failed"


def test_final_state_includes_step_statuses_and_summary():
    """Verify that the final state contains comprehensive step statuses and safe summary."""
    state = run_sandbox_agent(VALID_NODE_MANIFEST, workflow_id="wf-node-summary-01")

    summary = state["final_summary"]
    assert summary["workflow_id"] == "wf-node-summary-01"
    assert summary["status"] == "completed"
    assert summary["total_steps"] == 4
    assert summary["completed_steps"] == 4
    assert summary["failed_steps"] == 0
    assert summary["skipped_steps"] == 0
    assert summary["error_details"] is None
    assert summary["finished_at"] is not None

    # Safe manifest summary assertions
    manifest_summary = summary["manifest_summary"]
    assert manifest_summary["project_name"] == "agent-nextjs-app"
    assert manifest_summary["project_type"] == "nextjs_app"
    assert manifest_summary["runtime"] == "node 20.14.0"
    assert manifest_summary["package_manager"] == "pnpm"
    assert manifest_summary["port"] == 3000
    assert manifest_summary["env_var_names"] == ["PORT", "API_BASE_URL"]


def test_workflow_service_langgraph_integration():
    """Verify that WorkflowService properly invokes and retains LangGraph agent state."""
    from app.schemas import SetupManifest

    manifest = SetupManifest(**VALID_PYTHON_MANIFEST)
    create_res = workflow_service.create_workflow(manifest)

    # API create response contract
    assert create_res.workflow_id.startswith("wf-")
    assert create_res.status.value in ["queued", "running"]
    assert len(create_res.steps) == 4

    # Status response contract
    status_res = workflow_service.get_workflow(create_res.workflow_id)
    assert status_res is not None
    assert status_res.workflow_id == create_res.workflow_id
    assert status_res.status.value == "completed"
    assert len(status_res.steps) == 4

    # Raw LangGraph agent state is accessible
    raw_agent_state = workflow_service.get_agent_state(create_res.workflow_id)
    assert raw_agent_state is not None
    assert raw_agent_state["workflow_id"] == create_res.workflow_id
    assert raw_agent_state["status"] == "completed"
    assert "final_summary" in raw_agent_state

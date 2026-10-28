"""Unit tests for the sandbox manifest validation, security, and workflow endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.workflow_service import workflow_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_workflow_store():
    """Ensure in-memory store is clean between test runs."""
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


VALID_PYTHON_MANIFEST = {
    "project_name": "fastapi-sample-api",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn[standard]>=0.29.0", "pydantic>=2.7.1"],
    "env_var_names": ["PORT", "DATABASE_URL", "APP_ENV"],
    "port": 8000,
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
    "repo_url": "https://github.com/tiangolo/fastapi-realworld-example",
    "branch": "main",
}

VALID_NODE_MANIFEST = {
    "project_name": "nextjs-saas-starter",
    "project_type": "nextjs_app",
    "runtime": "node",
    "runtime_version": "20.14.0",
    "package_manager": "pnpm",
    "dependencies": ["next@14.2.3", "react@18.3.1", "react-dom@18.3.1"],
    "env_var_names": ["PORT", "NEXT_PUBLIC_API_URL"],
    "port": 3000,
    "start_command": "pnpm dev",
    "test_command": "pnpm test",
}


def test_valid_manifest_passes_validation():
    """Verify that a properly structured manifest passes validation."""
    response = client.post("/api/v1/sandbox/validate", json=VALID_PYTHON_MANIFEST)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert len(data["errors"]) == 0
    assert data["normalized_manifest"] is not None
    assert data["normalized_manifest"]["project_name"] == "fastapi-sample-api"
    assert data["normalized_manifest"]["port"] == 8000


def test_invalid_manifest_returns_useful_validation_errors():
    """Verify that malformed manifests return clear, actionable field errors."""
    invalid_manifest = {
        "project_name": "Invalid Project With Spaces!",
        "project_type": "fastapi_service",
        "runtime": "python",
        "runtime_version": "3.11",
        "package_manager": "npm",  # Incompatible with Python runtime!
        "env_var_names": [],
    }
    response = client.post("/api/v1/sandbox/validate", json=invalid_manifest)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert len(data["errors"]) > 0

    error_fields = [e["field"] for e in data["errors"]]
    error_messages = " ".join(e["message"] for e in data["errors"])

    # Checks field validation and compatibility error message
    assert any("project_name" in f for f in error_fields)
    assert not any(e["message"].startswith("Value error, ") for e in data["errors"])


def test_extra_forbidden_fields_are_rejected():
    """Verify that extra unexpected keys (e.g. secrets or unmodeled parameters) are rejected."""
    manifest_with_extra = {
        **VALID_PYTHON_MANIFEST,
        "unexpected_secret_token": "ghp_1234567890abcdef",
    }
    response = client.post("/api/v1/sandbox/validate", json=manifest_with_extra)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert any("extra" in e["error_type"].lower() for e in data["errors"])


def test_env_var_values_and_secrets_are_rejected_and_not_exposed():
    """Verify that passing key=value assignments is rejected and secret values are never echoed."""
    secret_value = "supersecretpassword12345"
    manifest_with_secrets = {
        **VALID_PYTHON_MANIFEST,
        "env_var_names": [
            "PORT",
            f"DATABASE_URL=postgres://user:{secret_value}@localhost:5432/db",
        ],
    }
    response = client.post("/api/v1/sandbox/validate", json=manifest_with_secrets)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert any("Only variable names are accepted, never values" in e["message"] for e in data["errors"])
    # CRITICAL SECURITY ASSERTION: Secret password must never be mirrored in response text
    assert secret_value not in response.text


def test_setup_returns_unique_workflow_id_and_initial_steps():
    """Verify that POST /api/v1/sandbox/setup initiates a workflow and returns initial progression."""
    response_1 = client.post("/api/v1/sandbox/setup", json=VALID_PYTHON_MANIFEST)
    assert response_1.status_code == 201
    data_1 = response_1.json()
    assert "workflow_id" in data_1
    assert data_1["workflow_id"].startswith("wf-")
    assert data_1["is_simulated"] is True
    assert data_1["status"] in ["queued", "running", "awaiting_approval"]
    assert len(data_1["steps"]) == 4

    # Verify initial step states (validation completed, subsequent steps pending approval)
    steps = data_1["steps"]
    assert steps[0]["name"] == "validate_manifest"
    assert steps[0]["status"] == "completed"
    assert steps[1]["name"] == "prepare_environment"
    assert steps[1]["status"] in ["pending", "running"]
    assert steps[2]["name"] == "resolve_dependencies"
    assert steps[2]["status"] == "pending"

    response_2 = client.post("/api/v1/sandbox/setup", json=VALID_NODE_MANIFEST)
    assert response_2.status_code == 201
    data_2 = response_2.json()
    assert data_2["workflow_id"].startswith("wf-")

    # Workflow IDs must be unique
    assert data_1["workflow_id"] != data_2["workflow_id"]


def test_setup_with_invalid_manifest_returns_422():
    """Verify that setup with invalid manifest returns HTTP 422 with structured APIErrorResponse."""
    invalid_manifest = {
        "project_name": "invalid-project",
        "project_type": "fastapi_service",
        "runtime": "python",
        "runtime_version": "3.11",
        "package_manager": "npm",  # Incompatible!
    }
    response = client.post("/api/v1/sandbox/setup", json=invalid_manifest)
    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "MANIFEST_VALIDATION_FAILED"
    assert "detail" in data
    assert isinstance(data["detail"], str)
    assert data["errors"] is not None
    assert len(data["errors"]) > 0


def test_workflow_status_can_be_retrieved():
    """Verify that workflow progress and step details can be queried by workflow ID."""
    create_res = client.post("/api/v1/sandbox/setup", json=VALID_PYTHON_MANIFEST)
    workflow_id = create_res.json()["workflow_id"]

    status_res = client.get(f"/api/v1/sandbox/status/{workflow_id}")
    assert status_res.status_code == 200
    status_data = status_res.json()

    assert status_data["workflow_id"] == workflow_id
    assert status_data["is_simulated"] is True
    assert status_data["status"] in ["queued", "running", "completed", "failed", "awaiting_approval"]
    assert len(status_data["steps"]) == 4

    # Verify step names and ordering
    step_names = [s["name"] for s in status_data["steps"]]
    assert step_names == [
        "validate_manifest",
        "prepare_environment",
        "resolve_dependencies",
        "run_health_checks",
    ]

    # Verify manifest summary does not expose secret values
    manifest_summary = status_data["manifest_summary"]
    assert manifest_summary["project_name"] == "fastapi-sample-api"
    assert manifest_summary["env_var_names"] == ["PORT", "DATABASE_URL", "APP_ENV"]


def test_unknown_workflow_id_returns_404():
    """Verify that querying a non-existent workflow ID returns HTTP 404 with APIErrorResponse."""
    response = client.get("/api/v1/sandbox/status/wf-unknown-id-9999")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()
    assert data["error_code"] == "WORKFLOW_NOT_FOUND"


def test_manifest_schema_endpoint():
    """Verify GET /api/v1/sandbox/manifest/schema returns valid JSON schema."""
    response = client.get("/api/v1/sandbox/manifest/schema")
    assert response.status_code == 200
    schema = response.json()
    assert "properties" in schema
    assert "project_name" in schema["properties"]
    assert "package_manager" in schema["properties"]
    assert "runtime" in schema["properties"]

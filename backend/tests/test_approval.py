"""Comprehensive unit and integration tests for explicit user approval gate."""

import pytest
from fastapi.testclient import TestClient

from app.agent.graph import resume_sandbox_agent, run_sandbox_agent
from app.agent.nodes import compute_plan_fingerprint
from app.main import app
from app.schemas import ApprovalDecisionRequest, SetupManifest
from app.services.workflow_service import workflow_service


client = TestClient(app)

SAMPLE_PYTHON_MANIFEST = {
    "project_name": "approval-fastapi-service",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn[standard]>=0.29.0"],
    "env_var_names": ["PORT", "DATABASE_URL"],
    "port": 8000,
    "setup_commands": ["poetry install --no-root"],
    "validation_commands": ["poetry run pytest"],
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
    "branch": "main",
}


@pytest.fixture(autouse=True)
def clean_workflow_store():
    """Ensure in-memory workflow store is clean between test runs."""
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


def test_workflow_pauses_at_approval_gate_with_no_commands_executed():
    """Verify setup pauses at approval gate after planning and executes zero commands."""
    res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    assert res.status_code == 201
    data = res.json()

    workflow_id = data["workflow_id"]
    assert data["status"] == "awaiting_approval"
    assert data["approval_status"] == "awaiting_approval"
    assert data["plan_fingerprint"] is not None
    assert len(data["plan_fingerprint"]) == 64
    assert len(data["execution_plan"]) == 2

    # Verify pipeline state: validate_manifest completed, but execution steps are PENDING
    steps = data["steps"]
    assert steps[0]["name"] == "validate_manifest"
    assert steps[0]["status"] == "completed"
    assert steps[1]["name"] == "prepare_environment"
    assert steps[1]["status"] == "pending"
    assert steps[2]["name"] == "resolve_dependencies"
    assert steps[2]["status"] == "pending"
    assert steps[3]["name"] == "run_health_checks"
    assert steps[3]["status"] == "pending"


def test_get_workflow_plan_endpoint():
    """Verify GET /api/v1/sandbox/{workflow_id}/plan returns the exact proposed plan and fingerprint."""
    res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    workflow_id = res.json()["workflow_id"]
    expected_fingerprint = res.json()["plan_fingerprint"]

    # Retrieve plan via GET /{workflow_id}/plan
    plan_res = client.get(f"/api/v1/sandbox/{workflow_id}/plan")
    assert plan_res.status_code == 200
    plan_data = plan_res.json()

    assert plan_data["workflow_id"] == workflow_id
    assert plan_data["status"] == "awaiting_approval"
    assert plan_data["approval_status"] == "awaiting_approval"
    assert plan_data["is_ready_for_approval"] is True
    assert plan_data["plan_fingerprint"] == expected_fingerprint
    assert len(plan_data["execution_plan"]) == 2
    assert plan_data["setup_commands"] == ["poetry install --no-root"]
    assert plan_data["validation_commands"] == ["poetry run pytest"]
    assert "python 3.11.9" in plan_data["runtime"]
    assert plan_data["package_manager"] == "poetry"

    # Also test alias route GET /plan/{workflow_id}
    alias_res = client.get(f"/api/v1/sandbox/plan/{workflow_id}")
    assert alias_res.status_code == 200
    assert alias_res.json()["workflow_id"] == workflow_id


def test_explicit_approval_resumes_and_completes_workflow():
    """Verify POST /api/v1/sandbox/{workflow_id}/approve resumes execution to completed state."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # Submit explicit approval
    appr_res = client.post(
        f"/api/v1/sandbox/{workflow_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint, "reason": "Approved by engineer"},
    )
    assert appr_res.status_code == 200
    data = appr_res.json()

    assert data["workflow_id"] == workflow_id
    assert data["status"] == "completed"
    assert data["approval_status"] == "approved"
    assert data["approved_at"] is not None

    # All steps completed
    steps = data["steps"]
    assert all(s["status"] == "completed" for s in steps)


def test_explicit_rejection_halts_workflow_cleanly_with_zero_commands():
    """Verify POST /api/v1/sandbox/{workflow_id}/reject stops execution cleanly with status rejected."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # Submit explicit rejection
    rej_res = client.post(
        f"/api/v1/sandbox/{workflow_id}/reject",
        json={
            "approved": False,
            "plan_fingerprint": fingerprint,
            "reason": "Security review denied package installation.",
        },
    )
    assert rej_res.status_code == 200
    data = rej_res.json()

    assert data["workflow_id"] == workflow_id
    assert data["status"] == "rejected"
    assert data["approval_status"] == "rejected"
    assert data["rejection_reason"] == "Security review denied package installation."

    # Verify execution steps remain unexecuted (never started)
    steps = data["steps"]
    assert steps[0]["name"] == "validate_manifest"
    assert steps[0]["status"] == "completed"
    for step in steps[1:]:
        assert step["status"] in ["pending", "skipped"]
        assert step["started_at"] is None
        assert step["duration_seconds"] is None

    # Status query confirms rejected state
    status_res = client.get(f"/api/v1/sandbox/status/{workflow_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "rejected"
    assert status_res.json()["approval_status"] == "rejected"


def test_approval_with_tampered_plan_fingerprint_is_rejected_with_conflict():
    """Verify approving with an altered plan fingerprint returns HTTP 409 conflict."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]

    # Supply an invalid/tampered fingerprint
    tampered_fingerprint = "0" * 64
    appr_res = client.post(
        f"/api/v1/sandbox/{workflow_id}/approve",
        json={"approved": True, "plan_fingerprint": tampered_fingerprint},
    )
    assert appr_res.status_code == 409
    error_data = appr_res.json()
    assert error_data["error_code"] == "PLAN_MISMATCH"
    assert "fingerprint mismatch" in error_data["detail"].lower()


def test_cannot_approve_workflow_not_awaiting_approval():
    """Verify attempting to approve an already approved or rejected workflow returns HTTP 400."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_PYTHON_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # First approval succeeds
    res1 = client.post(
        f"/api/v1/sandbox/{workflow_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
    )
    assert res1.status_code == 200

    # Second approval fails
    res2 = client.post(
        f"/api/v1/sandbox/{workflow_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
    )
    assert res2.status_code == 400
    assert res2.json()["error_code"] == "INVALID_WORKFLOW_STATE"
    assert "not currently awaiting approval" in res2.json()["detail"]


def test_approval_for_nonexistent_workflow_returns_404():
    """Verify attempting to retrieve plan or approve non-existent workflow returns HTTP 404."""
    # Plan retrieval on nonexistent ID
    res1 = client.get("/api/v1/sandbox/wf-nonexistent-123/plan")
    assert res1.status_code == 404
    assert res1.json()["error_code"] == "WORKFLOW_NOT_FOUND"

    # Approval on nonexistent ID
    res2 = client.post(
        "/api/v1/sandbox/wf-nonexistent-123/approve",
        json={"approved": True},
    )
    assert res2.status_code == 404
    assert res2.json()["error_code"] == "WORKFLOW_NOT_FOUND"

    # Rejection on nonexistent ID
    res3 = client.post(
        "/api/v1/sandbox/wf-nonexistent-123/reject",
        json={"approved": False},
    )
    assert res3.status_code == 404
    assert res3.json()["error_code"] == "WORKFLOW_NOT_FOUND"


def test_plan_fingerprint_is_deterministic():
    """Verify compute_plan_fingerprint produces reproducible digests."""
    plan_a = [
        {"name": "step1", "phase": "prep", "commands": ["echo 1", "echo 2"]},
        {"name": "step2", "phase": "install", "commands": ["npm install"]},
    ]
    plan_b = [
        {"name": "step1", "phase": "prep", "commands": ["echo 1", "echo 2"]},
        {"name": "step2", "phase": "install", "commands": ["npm install"]},
    ]
    plan_modified = [
        {"name": "step1", "phase": "prep", "commands": ["echo 1", "echo 2"]},
        {"name": "step2", "phase": "install", "commands": ["npm install --production"]},
    ]

    hash_a = compute_plan_fingerprint(plan_a)
    hash_b = compute_plan_fingerprint(plan_b)
    hash_mod = compute_plan_fingerprint(plan_modified)

    assert hash_a == hash_b
    assert hash_a != hash_mod
    assert len(hash_a) == 64

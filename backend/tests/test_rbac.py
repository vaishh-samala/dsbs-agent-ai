"""Tests for Role-Based Access Control (RBAC) in Developer Sandbox Bootstrapper."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.workflow_service import workflow_service


client = TestClient(app)

SAMPLE_MANIFEST = {
    "project_name": "rbac-test-service",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "pip",
    "dependencies": ["fastapi>=0.111.0", "uvicorn>=0.29.0"],
    "port": 8000,
    "setup_commands": ["pip install ."],
    "validation_commands": ["curl -s -f http://127.0.0.1:8000/ || true"],
}

DEV_HEADERS = {"Authorization": "Bearer developer-token", "X-User-Role": "developer"}
ADMIN_HEADERS = {"Authorization": "Bearer admin-token", "X-User-Role": "admin"}


@pytest.fixture(autouse=True)
def clean_workflow_store():
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


def test_developer_can_submit_setup_and_receive_pending_approval():
    """Developer can create a setup workflow and view its pending approval status."""
    res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "awaiting_approval"
    assert data["approval_status"] == "awaiting_approval"
    assert data["approval_required"] is True
    assert data["plan_fingerprint"] is not None


def test_developer_can_view_workflow_status_and_plan():
    """Developer can retrieve workflow status and proposed plan."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]

    status_res = client.get(f"/api/v1/sandbox/status/{wf_id}", headers=DEV_HEADERS)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "awaiting_approval"

    plan_res = client.get(f"/api/v1/sandbox/{wf_id}/plan", headers=DEV_HEADERS)
    assert plan_res.status_code == 200
    assert plan_res.json()["workflow_id"] == wf_id


def test_developer_approval_attempt_is_forbidden_403():
    """Developer calling the approval endpoint directly receives HTTP 403 Forbidden."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # Canonical endpoint
    appr_res = client.post(
        f"/api/v1/sandbox/{wf_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
        headers=DEV_HEADERS,
    )
    assert appr_res.status_code == 403
    err = appr_res.json()
    assert err["error_code"] == "FORBIDDEN"
    assert "Developer role is not authorized" in err["detail"]

    # Alias endpoint
    alias_res = client.post(
        f"/api/v1/sandbox/approve/{wf_id}",
        json={"approved": True, "plan_fingerprint": fingerprint},
        headers=DEV_HEADERS,
    )
    assert alias_res.status_code == 403
    assert alias_res.json()["error_code"] == "FORBIDDEN"


def test_developer_rejection_attempt_is_forbidden_403():
    """Developer calling the rejection endpoint directly receives HTTP 403 Forbidden."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # Canonical endpoint
    rej_res = client.post(
        f"/api/v1/sandbox/{wf_id}/reject",
        json={"approved": False, "plan_fingerprint": fingerprint},
        headers=DEV_HEADERS,
    )
    assert rej_res.status_code == 403
    err = rej_res.json()
    assert err["error_code"] == "FORBIDDEN"
    assert "Developer role is not authorized" in err["detail"]

    # Alias endpoint
    alias_res = client.post(
        f"/api/v1/sandbox/reject/{wf_id}",
        json={"approved": False, "plan_fingerprint": fingerprint},
        headers=DEV_HEADERS,
    )
    assert alias_res.status_code == 403
    assert alias_res.json()["error_code"] == "FORBIDDEN"


def test_developer_direct_execution_attempt_is_forbidden_403():
    """Developer attempting to directly trigger execution receives HTTP 403 Forbidden."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]

    exec_res = client.post(f"/api/v1/sandbox/{wf_id}/execute", headers=DEV_HEADERS)
    assert exec_res.status_code == 403
    assert exec_res.json()["error_code"] == "FORBIDDEN"

    alias_res = client.post(f"/api/v1/sandbox/execute/{wf_id}", headers=DEV_HEADERS)
    assert alias_res.status_code == 403
    assert alias_res.json()["error_code"] == "FORBIDDEN"


def test_unauthenticated_requests_are_unauthorized_401():
    """Unauthenticated calls to privileged endpoints return HTTP 401 Unauthorized."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # No auth header on approve
    appr_res = client.post(
        f"/api/v1/sandbox/{wf_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
        headers={},
    )
    assert appr_res.status_code == 401
    assert appr_res.json()["error_code"] == "UNAUTHORIZED"

    # No auth header on reject
    rej_res = client.post(
        f"/api/v1/sandbox/{wf_id}/reject",
        json={"approved": False, "plan_fingerprint": fingerprint},
        headers={},
    )
    assert rej_res.status_code == 401
    assert rej_res.json()["error_code"] == "UNAUTHORIZED"

    # No auth header on execute
    exec_res = client.post(f"/api/v1/sandbox/{wf_id}/execute", headers={})
    assert exec_res.status_code == 401
    assert exec_res.json()["error_code"] == "UNAUTHORIZED"

    # Invalid Bearer token
    bad_res = client.post(
        f"/api/v1/sandbox/{wf_id}/approve",
        headers={"Authorization": "Bearer invalid_token_xyz"},
    )
    assert bad_res.status_code == 401
    assert bad_res.json()["error_code"] == "UNAUTHORIZED"


def test_administrator_can_approve_valid_plan_and_proceed():
    """Administrator can approve an eligible pending plan, resuming execution."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    appr_res = client.post(
        f"/api/v1/sandbox/{wf_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint, "reason": "Admin sign-off granted"},
        headers=ADMIN_HEADERS,
    )
    assert appr_res.status_code == 200
    data = appr_res.json()
    assert data["status"] == "completed"
    assert data["approval_status"] == "approved"
    assert data["approved_at"] is not None


def test_administrator_can_reject_plan_preventing_execution():
    """Administrator can reject a plan, preventing any command execution."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    rej_res = client.post(
        f"/api/v1/sandbox/{wf_id}/reject",
        json={"approved": False, "plan_fingerprint": fingerprint, "reason": "Disallowed dependencies"},
        headers=ADMIN_HEADERS,
    )
    assert rej_res.status_code == 200
    data = rej_res.json()
    assert data["status"] == "rejected"
    assert data["approval_status"] == "rejected"
    assert data["rejection_reason"] == "Disallowed dependencies"

    # Verify execution commands were not run
    status_res = client.get(f"/api/v1/sandbox/status/{wf_id}", headers=DEV_HEADERS)
    assert status_res.status_code == 200
    for step in status_res.json()["steps"][1:]:
        assert step["status"] in ["pending", "skipped"]


def test_administrator_execute_requires_prior_approval():
    """Administrator calling execute on an unapproved plan receives HTTP 400."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]

    exec_res = client.post(f"/api/v1/sandbox/{wf_id}/execute", headers=ADMIN_HEADERS)
    assert exec_res.status_code == 400
    assert exec_res.json()["error_code"] == "PLAN_NOT_APPROVED"


def test_approval_decision_is_persisted():
    """Workflow state persists approval status across subsequent queries."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST, headers=DEV_HEADERS)
    wf_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    appr_res = client.post(
        f"/api/v1/sandbox/{wf_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
        headers=ADMIN_HEADERS,
    )
    assert appr_res.status_code == 200

    # Query status as developer
    dev_status = client.get(f"/api/v1/sandbox/status/{wf_id}", headers=DEV_HEADERS)
    assert dev_status.status_code == 200
    assert dev_status.json()["status"] == "completed"
    assert dev_status.json()["approval_status"] == "approved"


"""Unit and integration tests for Live Agent Workflow Progress, 6-stage lifecycle, and SSE."""

import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import StageStatus, WorkflowStatus
from app.services.workflow_service import workflow_service


client = TestClient(app)

SAMPLE_MANIFEST = {
    "project_name": "live-progress-fastapi",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn>=0.29.0"],
    "env_var_names": ["PORT"],
    "port": 8000,
    "setup_commands": ["poetry install --no-root"],
    "validation_commands": ["poetry run pytest"],
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
    "branch": "main",
}


@pytest.fixture(autouse=True)
def clean_workflow_store():
    workflow_service.clear_all()
    yield
    workflow_service.clear_all()


def test_six_stages_structure_and_initial_state():
    """Verify that POST /setup returns all 6 stages with expected metadata."""
    res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST)
    assert res.status_code == 201
    data = res.json()

    # Verify live progress fields
    assert "current_stage" in data
    assert data["current_stage"] == "approval"
    assert data["current_message"] == "Waiting for human approval"
    assert data["progress_percentage"] == 50
    assert data["approval_required"] is True
    assert data["completed_stages"] == ["inspection", "planning"]

    stages = data["stages"]
    assert len(stages) == 6

    # Verify stage order and metadata
    stage_ids = [s["id"] for s in stages]
    assert stage_ids == [
        "inspection",
        "planning",
        "approval",
        "execution",
        "verification",
        "final_result",
    ]

    # Stage 1: Inspection
    assert stages[0]["number"] == 1
    assert stages[0]["title"] == "Repository Inspection"
    assert stages[0]["status"] == "completed"
    assert stages[0]["message"] == "Repository inspection completed."

    # Stage 2: Planning
    assert stages[1]["number"] == 2
    assert stages[1]["title"] == "Setup Planning"
    assert stages[1]["status"] == "completed"
    assert stages[1]["message"] == "Setup plan generated successfully."

    # Stage 3: Approval
    assert stages[2]["number"] == 3
    assert stages[2]["title"] == "Human Approval"
    assert stages[2]["status"] == "waiting_for_approval"
    assert stages[2]["message"] == "Waiting for your approval."

    # Stage 4: Execution
    assert stages[3]["number"] == 4
    assert stages[3]["title"] == "Sandbox Execution"
    assert stages[3]["status"] == "pending"

    # Stage 5: Verification
    assert stages[4]["number"] == 5
    assert stages[4]["title"] == "Environment Verification"
    assert stages[4]["status"] == "pending"

    # Stage 6: Final Result
    assert stages[5]["number"] == 6
    assert stages[5]["title"] == "Final Result"
    assert stages[5]["status"] == "pending"


def test_workflow_approval_progresses_through_execution_and_verification():
    """Verify that approving a plan completes execution, verification, and final result."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    # Submit approval
    appr_res = client.post(
        f"/api/v1/sandbox/{workflow_id}/approve",
        json={"approved": True, "plan_fingerprint": fingerprint},
    )
    assert appr_res.status_code == 200
    data = appr_res.json()

    assert data["status"] == "completed"
    assert data["current_stage"] == "completed"
    assert data["current_message"] == "Setup completed successfully"
    assert data["progress_percentage"] == 100
    assert data["approval_required"] is False
    assert len(data["completed_stages"]) == 6

    stages = {s["id"]: s for s in data["stages"]}
    assert stages["inspection"]["status"] == "completed"
    assert stages["planning"]["status"] == "completed"
    assert stages["approval"]["status"] == "completed"
    assert stages["execution"]["status"] == "completed"
    assert stages["verification"]["status"] == "completed"
    assert stages["final_result"]["status"] == "completed"

    # Verify execution details and verification checks
    assert data["execution_steps"] is not None
    assert len(data["execution_steps"]) > 0
    assert data["verification_results"] is not None
    assert data["verification_results"]["healthy"] is True


def test_workflow_rejection_halts_at_approval_and_skips_subsequent_stages():
    """Verify that rejecting a plan stops at approval stage and skips execution & verification."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]
    fingerprint = init_res.json()["plan_fingerprint"]

    rej_res = client.post(
        f"/api/v1/sandbox/{workflow_id}/reject",
        json={"approved": False, "plan_fingerprint": fingerprint, "reason": "Operator denied approval"},
    )
    assert rej_res.status_code == 200
    data = rej_res.json()

    assert data["status"] == "rejected"
    assert data["current_stage"] == "rejected"
    assert data["current_message"] == "Setup rejected"
    assert data["approval_status"] == "rejected"

    stages = {s["id"]: s for s in data["stages"]}
    assert stages["inspection"]["status"] == "completed"
    assert stages["planning"]["status"] == "completed"
    assert stages["approval"]["status"] == "rejected"
    assert stages["approval"]["message"] == "Your setup plan was rejected. No commands were executed."
    assert stages["execution"]["status"] == "skipped"
    assert stages["verification"]["status"] == "skipped"
    assert stages["final_result"]["status"] == "rejected"


def test_background_creation_and_polling():
    """Verify that POST /setup?background=true initializes in running state and transitions to approval."""
    init_res = client.post("/api/v1/sandbox/setup?background=true", json=SAMPLE_MANIFEST)
    assert init_res.status_code == 201
    data = init_res.json()

    workflow_id = data["workflow_id"]
    # Initial background state
    assert data["status"] in ["running", "awaiting_approval"]

    # Poll status endpoint until awaiting approval
    start = time.time()
    reached_approval = False
    while time.time() - start < 5.0:
        status_res = client.get(f"/api/v1/sandbox/status/{workflow_id}")
        assert status_res.status_code == 200
        cur_data = status_res.json()
        if cur_data["status"] == "awaiting_approval":
            reached_approval = True
            assert cur_data["approval_required"] is True
            assert cur_data["current_message"] == "Waiting for human approval"
            break
        time.sleep(0.1)

    assert reached_approval is True


def test_sse_events_stream_endpoint():
    """Verify GET /api/v1/sandbox/{workflow_id}/events opens SSE stream and returns status event."""
    init_res = client.post("/api/v1/sandbox/setup", json=SAMPLE_MANIFEST)
    workflow_id = init_res.json()["workflow_id"]

    with client.stream("GET", f"/api/v1/sandbox/{workflow_id}/events") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        # Read first event chunk
        lines = []
        for line in response.iter_lines():
            if line:
                lines.append(line)
            if len(lines) >= 2:
                break

        assert any("event: status" in l for l in lines)
        assert any("data:" in l for l in lines)


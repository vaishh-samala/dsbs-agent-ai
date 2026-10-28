"""In-memory workflow management and simulated orchestration service."""

from datetime import datetime, timedelta, timezone
import threading
from typing import Any, Dict, List, Optional
import uuid

from app.schemas import (
    SetupManifest,
    StepStatus,
    WorkflowCreateResponse,
    WorkflowStatus,
    WorkflowStatusResponse,
    WorkflowStep,
)


class WorkflowRecord:
    """Internal model for an in-memory workflow instance."""

    def __init__(self, workflow_id: str, manifest: SetupManifest):
        now = datetime.now(timezone.utc)
        self.workflow_id = workflow_id
        self.manifest = manifest
        self.created_at = now
        self.updated_at = now
        self.completed_at: Optional[datetime] = None
        self.status = WorkflowStatus.RUNNING
        self.is_simulated = True
        self.error_details: Optional[str] = None

        # Check if manifest triggers simulated failure
        self.should_fail = (
            "fail" in manifest.project_name.lower()
            or any("fail" in d.lower() for d in manifest.dependencies)
        )

        # Initial step progression returned at workflow creation
        self.initial_steps: List[WorkflowStep] = [
            WorkflowStep(
                name="validate_manifest",
                description="Validate manifest syntax, runtime compatibility, and security boundaries.",
                status=StepStatus.COMPLETED,
                started_at=now,
                completed_at=now + timedelta(milliseconds=120),
                duration_seconds=0.12,
            ),
            WorkflowStep(
                name="prepare_environment",
                description=f"Allocate isolated virtual container and configure {manifest.runtime.value} {manifest.runtime_version}.",
                status=StepStatus.RUNNING,
                started_at=now + timedelta(milliseconds=130),
                completed_at=None,
                duration_seconds=None,
            ),
            WorkflowStep(
                name="resolve_dependencies",
                description=f"Resolve package lockfiles and cache {len(manifest.dependencies)} dependencies using {manifest.package_manager.value}.",
                status=StepStatus.PENDING,
                started_at=None,
                completed_at=None,
                duration_seconds=None,
            ),
            WorkflowStep(
                name="run_health_checks",
                description=f"Probe service readiness probe on port {manifest.port} and execute smoke assertions.",
                status=StepStatus.PENDING,
                started_at=None,
                completed_at=None,
                duration_seconds=None,
            ),
        ]

        # Computed deterministic completed steps for status queries
        self.final_steps: List[WorkflowStep] = [
            self.initial_steps[0],
            WorkflowStep(
                name="prepare_environment",
                description=f"Allocate isolated virtual container and configure {manifest.runtime.value} {manifest.runtime_version}.",
                status=StepStatus.COMPLETED,
                started_at=now + timedelta(milliseconds=130),
                completed_at=now + timedelta(milliseconds=650),
                duration_seconds=0.52,
            ),
            WorkflowStep(
                name="resolve_dependencies",
                description=f"Resolve package lockfiles and cache {len(manifest.dependencies)} dependencies using {manifest.package_manager.value}.",
                status=StepStatus.COMPLETED,
                started_at=now + timedelta(milliseconds=660),
                completed_at=now + timedelta(milliseconds=1850),
                duration_seconds=1.19,
            ),
            WorkflowStep(
                name="run_health_checks",
                description=f"Probe service readiness probe on port {manifest.port} and execute smoke assertions.",
                status=StepStatus.FAILED if self.should_fail else StepStatus.COMPLETED,
                started_at=now + timedelta(milliseconds=1860),
                completed_at=now + timedelta(milliseconds=2400 if self.should_fail else 2300),
                duration_seconds=0.54 if self.should_fail else 0.44,
                error_message=(
                    f"Health check probe failed: port {manifest.port} connection refused. Expected service to bind within timeout."
                    if self.should_fail
                    else None
                ),
            ),
        ]

        if self.should_fail:
            self.final_status = WorkflowStatus.FAILED
            self.error_details = (
                "Simulated sandbox health verification failed. Service probe did not receive HTTP 200 within timeout."
            )
            self.completed_at = self.final_steps[3].completed_at
        else:
            self.final_status = WorkflowStatus.COMPLETED
            self.completed_at = self.final_steps[3].completed_at

    def to_create_response(self) -> WorkflowCreateResponse:
        """Return response for POST /setup with initial running steps."""
        return WorkflowCreateResponse(
            workflow_id=self.workflow_id,
            status=self.status,
            is_simulated=self.is_simulated,
            created_at=self.created_at,
            steps=self.initial_steps,
            message="Deterministic mock sandbox setup initialized.",
        )

    def to_status_response(self) -> WorkflowStatusResponse:
        """Return response for GET /status with completed deterministic pipeline."""
        return WorkflowStatusResponse(
            workflow_id=self.workflow_id,
            status=self.final_status,
            is_simulated=self.is_simulated,
            created_at=self.created_at,
            updated_at=datetime.now(timezone.utc),
            completed_at=self.completed_at,
            steps=self.final_steps,
            manifest_summary={
                "project_name": self.manifest.project_name,
                "project_type": self.manifest.project_type.value,
                "runtime": f"{self.manifest.runtime.value} {self.manifest.runtime_version}",
                "package_manager": self.manifest.package_manager.value,
                "dependencies_count": len(self.manifest.dependencies),
                "port": self.manifest.port,
                # Safe: only environment variable names (keys) are echoed, never values
                "env_var_names": self.manifest.env_var_names,
            },
            error_details=self.error_details,
        )


class WorkflowService:
    """Thread-safe in-memory store for managing simulated workflow instances."""

    def __init__(self) -> None:
        self._store: Dict[str, WorkflowRecord] = {}
        self._lock = threading.Lock()

    def create_workflow(self, manifest: SetupManifest) -> WorkflowCreateResponse:
        """Initialize a new simulated setup workflow."""
        workflow_id = f"wf-{uuid.uuid4().hex[:12]}"
        record = WorkflowRecord(workflow_id=workflow_id, manifest=manifest)

        with self._lock:
            self._store[workflow_id] = record

        return record.to_create_response()

    def get_workflow(self, workflow_id: str) -> Optional[WorkflowStatusResponse]:
        """Fetch status of a workflow by ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        return record.to_status_response()

    def clear_all(self) -> None:
        """Clear store (primarily used in tests)."""
        with self._lock:
            self._store.clear()


# Global singleton instance for application use
workflow_service = WorkflowService()

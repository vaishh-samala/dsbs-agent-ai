"""In-memory workflow management driven by the LangGraph orchestration agent."""

from datetime import datetime, timezone
import threading
from typing import Any, Dict, List, Optional
import uuid

from app.agent.graph import run_sandbox_agent
from app.agent.state import SandboxAgentState
from app.schemas import (
    SetupManifest,
    StepStatus,
    WorkflowCreateResponse,
    WorkflowStatus,
    WorkflowStatusResponse,
    WorkflowStep,
)


class WorkflowRecord:
    """Internal model for an in-memory workflow instance powered by LangGraph."""

    def __init__(self, workflow_id: str, manifest: SetupManifest):
        now = datetime.now(timezone.utc)
        self.workflow_id = workflow_id
        self.manifest = manifest
        self.created_at = now
        self.updated_at = now
        self.is_simulated = True

        # Execute the compiled LangGraph orchestration agent
        manifest_dict = manifest.model_dump(mode="json")
        self.agent_state: SandboxAgentState = run_sandbox_agent(manifest_dict, workflow_id=workflow_id)

        # Initial step progression representation returned at creation time (POST /setup)
        self.initial_steps: List[WorkflowStep] = [
            WorkflowStep(
                name="validate_manifest",
                description="Validate manifest syntax, runtime compatibility, and security boundaries.",
                status=StepStatus.COMPLETED,
                started_at=now,
                completed_at=now,
                duration_seconds=0.12,
            ),
            WorkflowStep(
                name="prepare_environment",
                description=f"Allocate isolated virtual container and configure {manifest.runtime.value} {manifest.runtime_version}.",
                status=StepStatus.RUNNING,
                started_at=now,
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

        # Extract step statuses and summary from LangGraph execution state
        step_dict = self.agent_state.get("step_statuses", {})
        final_summary = self.agent_state.get("final_summary", {})
        agent_status = self.agent_state.get("status", "completed")

        self.final_status = WorkflowStatus.COMPLETED if agent_status == "completed" else WorkflowStatus.FAILED
        self.error_details = final_summary.get("error_details")

        # Canonical sequence of the 4 setup workflow steps
        step_definitions = [
            ("validate_manifest", "Validate manifest syntax, runtime compatibility, and security boundaries."),
            (
                "prepare_environment",
                f"Allocate isolated virtual container and configure {manifest.runtime.value} {manifest.runtime_version}.",
            ),
            (
                "resolve_dependencies",
                f"Resolve package lockfiles and cache {len(manifest.dependencies)} dependencies using {manifest.package_manager.value}.",
            ),
            (
                "run_health_checks",
                f"Probe service readiness probe on port {manifest.port} and execute smoke assertions.",
            ),
        ]

        self.final_steps: List[WorkflowStep] = []
        last_completed_at: Optional[datetime] = None

        for step_name, default_desc in step_definitions:
            if step_name in step_dict:
                raw_s = step_dict[step_name]
                st_val = raw_s.get("status", "pending")
                st_status = StepStatus(st_val) if st_val in [e.value for e in StepStatus] else StepStatus.PENDING

                start_dt = (
                    datetime.fromisoformat(raw_s["started_at"])
                    if raw_s.get("started_at")
                    else None
                )
                comp_dt = (
                    datetime.fromisoformat(raw_s["completed_at"])
                    if raw_s.get("completed_at")
                    else None
                )
                if comp_dt:
                    last_completed_at = comp_dt

                self.final_steps.append(
                    WorkflowStep(
                        name=step_name,
                        description=raw_s.get("description", default_desc),
                        status=st_status,
                        started_at=start_dt,
                        completed_at=comp_dt,
                        duration_seconds=raw_s.get("duration_seconds"),
                        error_message=raw_s.get("error_message"),
                    )
                )
            else:
                # Step was skipped (e.g. execution halted prior to verify_setup)
                self.final_steps.append(
                    WorkflowStep(
                        name=step_name,
                        description=default_desc,
                        status=StepStatus.SKIPPED if self.final_status == WorkflowStatus.FAILED else StepStatus.PENDING,
                        started_at=None,
                        completed_at=None,
                        duration_seconds=None,
                        error_message="Step skipped due to previous execution failure."
                        if self.final_status == WorkflowStatus.FAILED
                        else None,
                    )
                )

        self.completed_at = last_completed_at or datetime.now(timezone.utc)

    def to_create_response(self) -> WorkflowCreateResponse:
        """Return response for POST /setup with initial progression."""
        return WorkflowCreateResponse(
            workflow_id=self.workflow_id,
            status=WorkflowStatus.RUNNING,
            is_simulated=self.is_simulated,
            created_at=self.created_at,
            steps=self.initial_steps,
            message="Deterministic mock sandbox setup initialized via LangGraph agent.",
        )

    def to_status_response(self) -> WorkflowStatusResponse:
        """Return response for GET /status with completed deterministic pipeline from LangGraph."""
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
                "env_var_names": self.manifest.env_var_names,
            },
            error_details=self.error_details,
        )


class WorkflowService:
    """Thread-safe in-memory store for managing workflow instances orchestrated by LangGraph."""

    def __init__(self) -> None:
        self._store: Dict[str, WorkflowRecord] = {}
        self._lock = threading.Lock()

    def create_workflow(self, manifest: SetupManifest) -> WorkflowCreateResponse:
        """Initialize a new sandbox setup workflow orchestrated by LangGraph."""
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

    def get_agent_state(self, workflow_id: str) -> Optional[SandboxAgentState]:
        """Retrieve raw LangGraph agent state for a workflow ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        return record.agent_state

    def clear_all(self) -> None:
        """Clear store (used in test fixtures)."""
        with self._lock:
            self._store.clear()


# Global singleton instance for application use
workflow_service = WorkflowService()

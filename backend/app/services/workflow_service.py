"""In-memory workflow management driven by the LangGraph orchestration agent with approval gate."""

from datetime import datetime, timezone
import threading
from typing import Any, Dict, List, Optional
import uuid

from app.agent.graph import get_sandbox_agent_state, resume_sandbox_agent, run_sandbox_agent
from app.agent.state import SandboxAgentState
from app.schemas import (
    ApprovalStatus,
    SetupManifest,
    StepStatus,
    WorkflowCreateResponse,
    WorkflowPlanResponse,
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
        self.completed_at: Optional[datetime] = None
        self.is_simulated = True

        # Canonical sequence of the 4 setup workflow steps
        self.step_definitions = [
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

        # Execute the compiled LangGraph agent up to the approval gate
        manifest_dict = manifest.model_dump(mode="json")
        self.agent_state: SandboxAgentState = run_sandbox_agent(manifest_dict, workflow_id=workflow_id)

        self._sync_state_from_agent()

    def _sync_state_from_agent(self) -> None:
        """Synchronize internal step models and overall workflow status from LangGraph state."""
        self.updated_at = datetime.now(timezone.utc)
        step_dict = self.agent_state.get("step_statuses", {})
        final_summary = self.agent_state.get("final_summary", {})
        agent_status = self.agent_state.get("status", "awaiting_approval")
        approval_status_str = self.agent_state.get("approval_status", "pending")

        if agent_status == "completed":
            self.final_status = WorkflowStatus.COMPLETED
        elif agent_status == "rejected" or approval_status_str == "rejected":
            self.final_status = WorkflowStatus.REJECTED
        elif agent_status == "failed":
            self.final_status = WorkflowStatus.FAILED
        elif agent_status == "awaiting_approval":
            self.final_status = WorkflowStatus.AWAITING_APPROVAL
        else:
            self.final_status = WorkflowStatus.RUNNING

        self.error_details = final_summary.get("error_details") or (
            "; ".join(self.agent_state.get("errors", [])) if self.agent_state.get("errors") else None
        )

        self.current_steps: List[WorkflowStep] = []
        last_completed_at: Optional[datetime] = None

        for step_name, default_desc in self.step_definitions:
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

                self.current_steps.append(
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
                # Step not yet run or skipped
                is_terminal = self.final_status in [WorkflowStatus.FAILED, WorkflowStatus.REJECTED]
                skipped_msg = (
                    "Step skipped: plan execution was rejected."
                    if self.final_status == WorkflowStatus.REJECTED
                    else "Step skipped due to previous execution failure."
                )
                self.current_steps.append(
                    WorkflowStep(
                        name=step_name,
                        description=default_desc,
                        status=StepStatus.SKIPPED if is_terminal else StepStatus.PENDING,
                        started_at=None,
                        completed_at=None,
                        duration_seconds=None,
                        error_message=skipped_msg if is_terminal else None,
                    )
                )

        if self.final_status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.REJECTED]:
            self.completed_at = last_completed_at or datetime.now(timezone.utc)

    def to_create_response(self) -> WorkflowCreateResponse:
        """Return response for POST /setup indicating formulated plan awaiting approval."""
        appr_status = (
            ApprovalStatus(self.agent_state.get("approval_status"))
            if self.agent_state.get("approval_status") in [e.value for e in ApprovalStatus]
            else ApprovalStatus.AWAITING_APPROVAL
        )

        msg = (
            "Manifest validated and execution plan formulated. Awaiting explicit user approval before execution."
            if self.final_status == WorkflowStatus.AWAITING_APPROVAL
            else "Workflow setup initialized."
        )

        return WorkflowCreateResponse(
            workflow_id=self.workflow_id,
            status=self.final_status,
            is_simulated=self.is_simulated,
            created_at=self.created_at,
            steps=self.current_steps,
            message=msg,
            approval_status=appr_status,
            plan_fingerprint=self.agent_state.get("plan_fingerprint"),
            execution_plan=self.agent_state.get("execution_plan"),
        )

    def to_status_response(self) -> WorkflowStatusResponse:
        """Return response for GET /status with progression, plan, and approval status."""
        appr_status = (
            ApprovalStatus(self.agent_state.get("approval_status"))
            if self.agent_state.get("approval_status") in [e.value for e in ApprovalStatus]
            else None
        )

        appr_dt = (
            datetime.fromisoformat(self.agent_state["approved_at"])
            if self.agent_state.get("approved_at")
            else None
        )

        return WorkflowStatusResponse(
            workflow_id=self.workflow_id,
            status=self.final_status,
            is_simulated=self.is_simulated,
            created_at=self.created_at,
            updated_at=self.updated_at,
            completed_at=self.completed_at,
            steps=self.current_steps,
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
            approval_status=appr_status,
            plan_fingerprint=self.agent_state.get("plan_fingerprint"),
            execution_plan=self.agent_state.get("execution_plan"),
            approved_at=appr_dt,
            rejection_reason=self.agent_state.get("rejection_reason"),
        )

    def to_plan_response(self) -> WorkflowPlanResponse:
        """Return structured plan response for user inspection."""
        appr_status = (
            ApprovalStatus(self.agent_state.get("approval_status"))
            if self.agent_state.get("approval_status") in [e.value for e in ApprovalStatus]
            else ApprovalStatus.AWAITING_APPROVAL
        )

        appr_dt = (
            datetime.fromisoformat(self.agent_state["approved_at"])
            if self.agent_state.get("approved_at")
            else None
        )

        return WorkflowPlanResponse(
            workflow_id=self.workflow_id,
            status=self.final_status,
            approval_status=appr_status,
            plan_fingerprint=self.agent_state.get("plan_fingerprint", ""),
            execution_plan=self.agent_state.get("execution_plan", []),
            setup_commands=self.manifest.setup_commands,
            validation_commands=self.manifest.validation_commands,
            runtime=f"{self.manifest.runtime.value} {self.manifest.runtime_version}",
            package_manager=self.manifest.package_manager.value,
            dependencies_count=len(self.manifest.dependencies),
            is_ready_for_approval=self.final_status == WorkflowStatus.AWAITING_APPROVAL,
            approved_at=appr_dt,
            rejection_reason=self.agent_state.get("rejection_reason"),
        )


class WorkflowService:
    """Thread-safe in-memory store for managing workflow instances orchestrated by LangGraph."""

    def __init__(self) -> None:
        self._store: Dict[str, WorkflowRecord] = {}
        self._lock = threading.Lock()

    def create_workflow(self, manifest: SetupManifest) -> WorkflowCreateResponse:
        """Initialize a new sandbox setup workflow orchestrated by LangGraph up to the approval gate."""
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

    def get_workflow_plan(self, workflow_id: str) -> Optional[WorkflowPlanResponse]:
        """Fetch the pending execution plan for a workflow by ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        return record.to_plan_response()

    def approve_workflow(
        self,
        workflow_id: str,
        approved: bool,
        reason: Optional[str] = None,
        plan_fingerprint: Optional[str] = None,
    ) -> WorkflowStatusResponse:
        """Submit approval or rejection decision and resume workflow execution."""
        with self._lock:
            record = self._store.get(workflow_id)
            if record is None:
                raise KeyError(f"Workflow '{workflow_id}' not found.")

            # Validate that the workflow is currently awaiting approval
            current_approval = record.agent_state.get("approval_status")
            if current_approval != "awaiting_approval":
                raise ValueError(
                    f"Workflow '{workflow_id}' is not currently awaiting approval (status: {current_approval})."
                )

            # Validate plan fingerprint to guard against stale/altered plans
            expected_fingerprint = record.agent_state.get("plan_fingerprint")
            if plan_fingerprint and expected_fingerprint and plan_fingerprint != expected_fingerprint:
                raise ValueError("Plan fingerprint mismatch. The proposed plan was altered.")

            # Resume LangGraph agent from the approval checkpoint
            updated_state = resume_sandbox_agent(
                workflow_id=workflow_id,
                approved=approved,
                reason=reason,
                plan_fingerprint=plan_fingerprint or expected_fingerprint,
            )
            record.agent_state = updated_state
            record._sync_state_from_agent()

            return record.to_status_response()

    def get_agent_state(self, workflow_id: str) -> Optional[SandboxAgentState]:
        """Retrieve raw LangGraph agent state for a workflow ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        # Prefer live state from checkpointer if available
        live_state = get_sandbox_agent_state(workflow_id)
        return live_state if live_state else record.agent_state

    def clear_all(self) -> None:
        """Clear store (used in test fixtures)."""
        with self._lock:
            self._store.clear()


# Global singleton instance for application use
workflow_service = WorkflowService()

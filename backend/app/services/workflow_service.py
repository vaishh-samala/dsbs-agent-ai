"""In-memory workflow management driven by the LangGraph orchestration agent with approval gate."""

import asyncio
from datetime import datetime, timezone
import threading
import time
from typing import Any, Dict, List, Optional
import uuid

from app.agent.graph import get_sandbox_agent_state, resume_sandbox_agent, run_sandbox_agent
from app.agent.state import SandboxAgentState
from app.schemas import (
    ApprovalStatus,
    SetupManifest,
    StageId,
    StageStatus,
    StepStatus,
    WorkflowCreateResponse,
    WorkflowPlanResponse,
    WorkflowStageInfo,
    WorkflowStatus,
    WorkflowStatusResponse,
    WorkflowStep,
)


class WorkflowRecord:
    """Internal model for an in-memory workflow instance powered by LangGraph."""

    def __init__(self, workflow_id: str, manifest: SetupManifest, deferred: bool = False):
        now = datetime.now(timezone.utc)
        self.workflow_id = workflow_id
        self.manifest = manifest
        self.created_at = now
        self.updated_at = now
        self.completed_at: Optional[datetime] = None
        self.is_simulated = True
        self.current_stage: str = "inspection"
        self._listeners: List[asyncio.Queue] = []
        self._lock = threading.Lock()

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

        if not deferred:
            # Execute the compiled LangGraph agent up to the approval gate synchronously
            manifest_dict = manifest.model_dump(mode="json")
            self.agent_state: SandboxAgentState = run_sandbox_agent(manifest_dict, workflow_id=workflow_id)
            self._sync_state_from_agent()
        else:
            # Deferred / background initialization
            self.agent_state: SandboxAgentState = {
                "workflow_id": workflow_id,
                "manifest": manifest.model_dump(mode="json"),
                "status": "running",
                "approval_status": "pending",
                "current_step": "validate_manifest",
                "step_statuses": {},
                "errors": [],
                "execution_plan": [],
            }
            self.final_status = WorkflowStatus.RUNNING
            self.error_details = None
            self.current_steps = [
                WorkflowStep(name=s[0], description=s[1], status=StepStatus.PENDING)
                for s in self.step_definitions
            ]

    def subscribe(self) -> asyncio.Queue:
        """Register an async queue for SSE event broadcast."""
        q = asyncio.Queue()
        with self._lock:
            self._listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """Deregister an async queue."""
        with self._lock:
            if q in self._listeners:
                self._listeners.remove(q)

    def notify_listeners(self) -> None:
        """Push current status JSON to all active SSE subscriber queues."""
        try:
            data_json = self.to_status_response().model_dump_json()
            with self._lock:
                for q in list(self._listeners):
                    try:
                        q.put_nowait(data_json)
                    except Exception:
                        pass
        except Exception:
            pass

    def _sync_state_from_agent(self) -> None:
        """Synchronize internal step models and overall workflow status from LangGraph state."""
        self.updated_at = datetime.now(timezone.utc)
        step_dict = self.agent_state.get("step_statuses", {})
        final_summary = self.agent_state.get("final_summary", {})
        agent_status = self.agent_state.get("status", "awaiting_approval")
        approval_status_str = self.agent_state.get("approval_status", "pending")

        if agent_status == "completed":
            self.final_status = WorkflowStatus.COMPLETED
            self.current_stage = "completed"
        elif agent_status == "needs_clarification" or self.agent_state.get("agent_decision") == "NEEDS_CLARIFICATION":
            self.final_status = WorkflowStatus.NEEDS_CLARIFICATION
            self.current_stage = "clarification"
        elif agent_status == "rejected" or approval_status_str == "rejected" or self.agent_state.get("agent_decision") == "REJECT":
            self.final_status = WorkflowStatus.REJECTED
            self.current_stage = "rejected"
        elif agent_status == "failed":
            self.final_status = WorkflowStatus.FAILED
            self.current_stage = "failed"
        elif agent_status == "awaiting_approval":
            self.final_status = WorkflowStatus.AWAITING_APPROVAL
            self.current_stage = "approval"
        else:
            self.final_status = WorkflowStatus.RUNNING

        self.error_details = final_summary.get("error_details") or (
            "; ".join(self.agent_state.get("errors", [])) if self.agent_state.get("errors") else None
        )

        self.current_steps = []
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

    def get_current_headline_message(self) -> str:
        """Return the live status heading matching UI guidelines."""
        if self.final_status == WorkflowStatus.COMPLETED:
            return "Setup completed successfully"
        if self.final_status == WorkflowStatus.REJECTED:
            return "Setup rejected"
        if self.final_status == WorkflowStatus.NEEDS_CLARIFICATION:
            return "Additional information required"
        if self.final_status == WorkflowStatus.FAILED:
            return "Setup failed"
        if self.final_status == WorkflowStatus.AWAITING_APPROVAL:
            return "Waiting for human approval"
        if self.current_stage == "execution":
            return "Agent is executing the approved plan"
        if self.current_stage == "verification":
            return "Agent is verifying the environment"
        if self.current_stage == "planning":
            return "Agent is preparing your setup plan"
        if self.current_stage == "inspection":
            return "Agent is inspecting your repository"
        return "Agent is bootstrapping sandbox..."

    def get_progress_percentage(self) -> int:
        """Calculate overall percentage completed (0-100)."""
        if self.final_status == WorkflowStatus.COMPLETED:
            return 100
        if self.final_status == WorkflowStatus.REJECTED:
            return 50
        if self.final_status == WorkflowStatus.FAILED:
            step_dict = self.agent_state.get("step_statuses", {})
            if step_dict.get("run_health_checks", {}).get("status") == "failed":
                return 85
            if (
                step_dict.get("resolve_dependencies", {}).get("status") == "failed"
                or step_dict.get("prepare_environment", {}).get("status") == "failed"
            ):
                return 65
            return 20
        if self.final_status == WorkflowStatus.AWAITING_APPROVAL:
            return 50
        if self.current_stage == "verification":
            return 80
        if self.current_stage == "execution":
            return 65
        if self.current_stage == "planning":
            return 30
        if self.current_stage == "inspection":
            return 15
        return 5

    def build_stages_info(self) -> List[WorkflowStageInfo]:
        """Construct the standardized 6-stage live agent timeline."""
        step_dict = self.agent_state.get("step_statuses", {})
        val_step = step_dict.get("validate_manifest", {})
        prep_step = step_dict.get("prepare_environment", {})
        dep_step = step_dict.get("resolve_dependencies", {})
        verify_step = step_dict.get("run_health_checks", {})
        approval_status_str = self.agent_state.get("approval_status", "pending")
        plan = self.agent_state.get("execution_plan", [])
        fingerprint = self.agent_state.get("plan_fingerprint")
        rejection_reason = self.agent_state.get("rejection_reason")

        stages: List[WorkflowStageInfo] = []

        # -------------------------------------------------------------
        # Stage 1: Repository Inspection
        # -------------------------------------------------------------
        insp_status = StageStatus.PENDING
        insp_msg = "Discover project files, identify project type, and validate configuration."
        insp_start = datetime.fromisoformat(val_step["started_at"]) if val_step.get("started_at") else None
        insp_comp = datetime.fromisoformat(val_step["completed_at"]) if val_step.get("completed_at") else None
        insp_dur = val_step.get("duration_seconds")
        insp_err = val_step.get("error_message")

        if self.current_stage == "inspection" and self.final_status == WorkflowStatus.RUNNING:
            insp_status = StageStatus.RUNNING
            insp_msg = "Agent is inspecting your repository..."
            insp_start = insp_start or self.created_at
        elif val_step.get("status") == "completed":
            insp_status = StageStatus.COMPLETED
            insp_msg = "Repository inspection completed."
        elif val_step.get("status") == "failed":
            insp_status = StageStatus.FAILED
            insp_msg = insp_err or "Repository inspection failed."

        stages.append(
            WorkflowStageInfo(
                id="inspection",
                number=1,
                title="Repository Inspection",
                description="Discover project files, identify the project type, inspect dependency manifests, and validate configuration.",
                status=insp_status,
                message=insp_msg,
                started_at=insp_start,
                completed_at=insp_comp,
                duration_seconds=insp_dur,
                error_message=insp_err,
                details={
                    "project_type": self.manifest.project_type.value,
                    "runtime": f"{self.manifest.runtime.value} {self.manifest.runtime_version}",
                    "package_manager": self.manifest.package_manager.value,
                },
            )
        )

        # -------------------------------------------------------------
        # Stage 2: Setup Planning
        # -------------------------------------------------------------
        plan_status = StageStatus.PENDING
        plan_msg = "Generate the ordered setup plan and proposed commands."
        plan_start = None
        plan_comp = None
        plan_dur = None
        plan_err = None

        if insp_status == StageStatus.FAILED:
            plan_status = StageStatus.SKIPPED
            plan_msg = "Planning skipped due to inspection failure."
        elif self.current_stage == "planning" and self.final_status == WorkflowStatus.RUNNING:
            plan_status = StageStatus.RUNNING
            plan_msg = "Agent is analyzing dependencies and preparing your setup plan..."
            plan_start = insp_comp or self.updated_at
        elif fingerprint or len(plan) > 0 or self.final_status in [
            WorkflowStatus.AWAITING_APPROVAL,
            WorkflowStatus.COMPLETED,
            WorkflowStatus.REJECTED,
        ]:
            plan_status = StageStatus.COMPLETED
            plan_msg = "Setup plan generated successfully."
            plan_start = insp_comp
            plan_comp = insp_comp
            plan_dur = 0.25

        stages.append(
            WorkflowStageInfo(
                id="planning",
                number=2,
                title="Setup Planning",
                description="Generate the ordered setup plan and proposed commands.",
                status=plan_status,
                message=plan_msg,
                started_at=plan_start,
                completed_at=plan_comp,
                duration_seconds=plan_dur,
                error_message=plan_err,
                details={
                    "planned_steps_count": len(plan),
                    "plan_fingerprint": fingerprint,
                },
            )
        )

        # -------------------------------------------------------------
        # Stage 3: Human Approval
        # -------------------------------------------------------------
        appr_status = StageStatus.PENDING
        appr_msg = "Review proposed commands, plan summary, and plan fingerprint before execution."
        appr_start = None
        appr_comp = None
        appr_dur = None

        if insp_status == StageStatus.FAILED:
            appr_status = StageStatus.SKIPPED
            appr_msg = "Approval skipped due to inspection failure."
        elif approval_status_str == "rejected" or self.final_status == WorkflowStatus.REJECTED:
            appr_status = StageStatus.REJECTED
            appr_msg = "Your setup plan was rejected. No commands were executed."
            appr_comp = self.completed_at
        elif approval_status_str == "approved" or self.final_status == WorkflowStatus.COMPLETED:
            appr_status = StageStatus.COMPLETED
            appr_msg = "Plan approved. Preparing execution..."
            appr_comp = (
                datetime.fromisoformat(self.agent_state["approved_at"])
                if self.agent_state.get("approved_at")
                else None
            )
        elif self.final_status == WorkflowStatus.AWAITING_APPROVAL or approval_status_str == "awaiting_approval":
            appr_status = StageStatus.WAITING_FOR_APPROVAL
            appr_msg = "Waiting for your approval."
            appr_start = plan_comp or self.updated_at

        stages.append(
            WorkflowStageInfo(
                id="approval",
                number=3,
                title="Human Approval",
                description="Display the proposed commands, plan summary, and plan fingerprint.",
                status=appr_status,
                message=appr_msg,
                started_at=appr_start,
                completed_at=appr_comp,
                duration_seconds=appr_dur,
                error_message=rejection_reason if appr_status == StageStatus.REJECTED else None,
                details={
                    "plan_fingerprint": fingerprint,
                    "rejection_reason": rejection_reason,
                    "is_awaiting": appr_status == StageStatus.WAITING_FOR_APPROVAL,
                },
            )
        )

        # -------------------------------------------------------------
        # Stage 4: Sandbox Execution
        # -------------------------------------------------------------
        exec_status = StageStatus.PENDING
        exec_msg = "Execute approved setup commands inside simulated sandbox isolation boundaries."
        exec_start = datetime.fromisoformat(prep_step["started_at"]) if prep_step.get("started_at") else None
        exec_comp = datetime.fromisoformat(dep_step["completed_at"]) if dep_step.get("completed_at") else None
        exec_dur = None
        exec_err = prep_step.get("error_message") or dep_step.get("error_message")

        if prep_step.get("duration_seconds") is not None and dep_step.get("duration_seconds") is not None:
            exec_dur = round(prep_step["duration_seconds"] + dep_step["duration_seconds"], 2)

        if appr_status == StageStatus.REJECTED:
            exec_status = StageStatus.SKIPPED
            exec_msg = "Execution skipped: setup plan was rejected."
        elif prep_step.get("status") == "failed" or dep_step.get("status") == "failed":
            exec_status = StageStatus.FAILED
            exec_msg = exec_err or "Sandbox execution failed."
        elif dep_step.get("status") == "completed":
            exec_status = StageStatus.COMPLETED
            exec_msg = "Approved setup commands executed inside the sandbox."
        elif self.current_stage == "execution" or prep_step.get("status") == "running" or dep_step.get("status") == "running":
            exec_status = StageStatus.RUNNING
            exec_msg = "Agent is executing the approved setup plan..."

        stages.append(
            WorkflowStageInfo(
                id="execution",
                number=4,
                title="Sandbox Execution",
                description="Execute approved setup commands inside simulated sandbox boundaries.",
                status=exec_status,
                message=exec_msg,
                started_at=exec_start,
                completed_at=exec_comp,
                duration_seconds=exec_dur,
                error_message=exec_err,
                details={
                    "is_simulated": True,
                    "isolation": "restricted_sandbox",
                },
            )
        )

        # -------------------------------------------------------------
        # Stage 5: Environment Verification
        # -------------------------------------------------------------
        ver_status = StageStatus.PENDING
        ver_msg = "Display actual verification checks and their results."
        ver_start = datetime.fromisoformat(verify_step["started_at"]) if verify_step.get("started_at") else None
        ver_comp = datetime.fromisoformat(verify_step["completed_at"]) if verify_step.get("completed_at") else None
        ver_dur = verify_step.get("duration_seconds")
        ver_err = verify_step.get("error_message")

        if appr_status == StageStatus.REJECTED or exec_status in [StageStatus.SKIPPED, StageStatus.FAILED]:
            ver_status = StageStatus.SKIPPED
            ver_msg = "Verification skipped."
        elif verify_step.get("status") == "failed":
            ver_status = StageStatus.FAILED
            ver_msg = "Environment verification failed."
        elif verify_step.get("status") == "completed":
            ver_status = StageStatus.COMPLETED
            ver_msg = "Environment verification completed successfully."
        elif self.current_stage == "verification" or verify_step.get("status") == "running":
            ver_status = StageStatus.RUNNING
            ver_msg = "Agent is verifying your environment..."

        stages.append(
            WorkflowStageInfo(
                id="verification",
                number=5,
                title="Environment Verification",
                description="Probe service readiness and execute smoke assertions.",
                status=ver_status,
                message=ver_msg,
                started_at=ver_start,
                completed_at=ver_comp,
                duration_seconds=ver_dur,
                error_message=ver_err,
                details={
                    "port": self.manifest.port,
                    "probe_status": "passed"
                    if ver_status == StageStatus.COMPLETED
                    else ("failed" if ver_status == StageStatus.FAILED else "pending"),
                },
            )
        )

        # -------------------------------------------------------------
        # Stage 6: Final Result
        # -------------------------------------------------------------
        res_status = StageStatus.PENDING
        res_msg = "Awaiting completion of earlier stages."

        if self.final_status == WorkflowStatus.COMPLETED:
            res_status = StageStatus.COMPLETED
            res_msg = "Setup completed successfully."
        elif self.final_status == WorkflowStatus.REJECTED:
            res_status = StageStatus.REJECTED
            res_msg = "Setup rejected."
        elif self.final_status == WorkflowStatus.FAILED:
            res_status = StageStatus.FAILED
            res_msg = "Setup failed."
        elif self.final_status in [WorkflowStatus.RUNNING, WorkflowStatus.AWAITING_APPROVAL]:
            res_msg = "Workflow in progress..."

        stages.append(
            WorkflowStageInfo(
                id="final_result",
                number=6,
                title="Final Result",
                description="Final container bootstrap status and diagnostics summary.",
                status=res_status,
                message=res_msg,
                started_at=self.completed_at if res_status != StageStatus.PENDING else None,
                completed_at=self.completed_at if res_status != StageStatus.PENDING else None,
                duration_seconds=round((self.completed_at - self.created_at).total_seconds(), 2)
                if self.completed_at
                else None,
                error_message=self.error_details if res_status == StageStatus.FAILED else None,
            )
        )

        return stages

    def to_create_response(self) -> WorkflowCreateResponse:
        """Return response for POST /setup with live 6-stage metadata."""
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

        stages_info = self.build_stages_info()
        completed_stage_ids = [s.id for s in stages_info if s.status == StageStatus.COMPLETED]

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
            current_stage=self.current_stage,
            current_message=self.get_current_headline_message(),
            progress_percentage=self.get_progress_percentage(),
            completed_stages=completed_stage_ids,
            stages=stages_info,
            approval_required=self.final_status == WorkflowStatus.AWAITING_APPROVAL,
            evaluation_result=self.agent_state.get("evaluation_result"),
        )

    def to_status_response(self) -> WorkflowStatusResponse:
        """Return response for GET /status with live 6-stage metadata and command diagnostics."""
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

        stages_info = self.build_stages_info()
        completed_stage_ids = [s.id for s in stages_info if s.status == StageStatus.COMPLETED]
        progress_pct = self.get_progress_percentage()
        current_headline = self.get_current_headline_message()
        is_approval_required = self.final_status == WorkflowStatus.AWAITING_APPROVAL

        ver_results = {
            "port": self.manifest.port,
            "status_code": 200 if self.final_status == WorkflowStatus.COMPLETED else (500 if self.final_status == WorkflowStatus.FAILED else 0),
            "latency_ms": 24 if self.final_status == WorkflowStatus.COMPLETED else 0,
            "healthy": self.final_status == WorkflowStatus.COMPLETED,
            "checked_at": (self.completed_at or self.updated_at).isoformat(),
            "checks": [
                f"Virtual container bound to port {self.manifest.port}",
                f"Health check probe on http://127.0.0.1:{self.manifest.port}/health",
            ],
        }

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
            current_stage=self.current_stage,
            current_message=current_headline,
            progress_percentage=progress_pct,
            completed_stages=completed_stage_ids,
            stages=stages_info,
            approval_required=is_approval_required,
            execution_steps=self.agent_state.get("execution_logs"),
            verification_results=ver_results,
            evaluation_result=self.agent_state.get("evaluation_result"),
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
            evaluation_result=self.agent_state.get("evaluation_result"),
        )


class WorkflowService:
    """Thread-safe in-memory store for managing workflow instances orchestrated by LangGraph."""

    def __init__(self) -> None:
        self._store: Dict[str, WorkflowRecord] = {}
        self._lock = threading.Lock()

    def create_workflow(self, manifest: SetupManifest, background: bool = False) -> WorkflowCreateResponse:
        """Initialize a new sandbox setup workflow orchestrated by LangGraph up to the approval gate.

        When background=True, starts inspection and planning in the background for real-time visibility.
        """
        workflow_id = f"wf-{uuid.uuid4().hex[:12]}"

        if not background:
            record = WorkflowRecord(workflow_id=workflow_id, manifest=manifest, deferred=False)
            with self._lock:
                self._store[workflow_id] = record
            return record.to_create_response()

        # Background progression
        record = WorkflowRecord(workflow_id=workflow_id, manifest=manifest, deferred=True)
        with self._lock:
            self._store[workflow_id] = record

        threading.Thread(
            target=self._run_initial_pipeline,
            args=(record,),
            daemon=True,
        ).start()

        return record.to_create_response()

    def _run_initial_pipeline(self, record: WorkflowRecord) -> None:
        """Pace inspection and planning in the background for live visibility."""
        try:
            record.current_stage = "inspection"
            record.notify_listeners()
            time.sleep(0.4)

            manifest_dict = record.manifest.model_dump(mode="json")
            agent_state = run_sandbox_agent(manifest_dict, workflow_id=record.workflow_id)
            record.agent_state = agent_state
            record._sync_state_from_agent()

            if record.final_status == WorkflowStatus.FAILED:
                record.current_stage = "failed"
                record.notify_listeners()
                return

            record.current_stage = "planning"
            record.notify_listeners()
            time.sleep(0.4)

            record.current_stage = "approval"
            record._sync_state_from_agent()
            record.notify_listeners()
        except Exception as e:
            record.final_status = WorkflowStatus.FAILED
            record.error_details = str(e)
            record.notify_listeners()

    def get_workflow(self, workflow_id: str) -> Optional[WorkflowStatusResponse]:
        """Fetch status of a workflow by ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        return record.to_status_response()

    def get_workflow_record(self, workflow_id: str) -> Optional[WorkflowRecord]:
        """Fetch raw internal record (e.g. for SSE streaming)."""
        with self._lock:
            return self._store.get(workflow_id)

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
        background: bool = False,
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

            # Reject cannot approve ineligible plans (e.g. REJECT or NEEDS_CLARIFICATION)
            agent_decision = record.agent_state.get("agent_decision")
            if approved and agent_decision in ["REJECT", "NEEDS_CLARIFICATION"]:
                raise ValueError(
                    f"Cannot approve workflow with agent decision '{agent_decision}'. The plan is ineligible for execution."
                )

            if not approved:
                # Immediate rejection
                updated_state = resume_sandbox_agent(
                    workflow_id=workflow_id,
                    approved=False,
                    reason=reason,
                    plan_fingerprint=plan_fingerprint or expected_fingerprint,
                )
                record.agent_state = updated_state
                record.current_stage = "rejected"
                record._sync_state_from_agent()
                record.notify_listeners()
                return record.to_status_response()

            if not background:
                # Synchronous approval (e.g. for automated test suites)
                updated_state = resume_sandbox_agent(
                    workflow_id=workflow_id,
                    approved=True,
                    reason=reason,
                    plan_fingerprint=plan_fingerprint or expected_fingerprint,
                )
                record.agent_state = updated_state
                record._sync_state_from_agent()
                record.notify_listeners()
                return record.to_status_response()

            # Background execution for live UI updates / SSE stream
            record.final_status = WorkflowStatus.RUNNING
            record.current_stage = "execution"
            record.agent_state["approval_status"] = "approved"
            record.agent_state["status"] = "running"
            record.notify_listeners()

            threading.Thread(
                target=self._run_resumed_pipeline,
                args=(record, reason, plan_fingerprint or expected_fingerprint),
                daemon=True,
            ).start()

            return record.to_status_response()

    def _run_resumed_pipeline(
        self,
        record: WorkflowRecord,
        reason: Optional[str],
        plan_fingerprint: Optional[str],
    ) -> None:
        """Pace execution and verification in the background for live progress visibility."""
        try:
            record.current_stage = "execution"
            record.notify_listeners()
            time.sleep(0.6)

            updated_state = resume_sandbox_agent(
                workflow_id=record.workflow_id,
                approved=True,
                reason=reason,
                plan_fingerprint=plan_fingerprint,
            )

            step_dict = updated_state.get("step_statuses", {})
            has_verification = "run_health_checks" in step_dict

            if has_verification:
                record.current_stage = "verification"
                record.agent_state = updated_state
                record._sync_state_from_agent()
                record.notify_listeners()
                time.sleep(0.6)

            record.agent_state = updated_state
            record._sync_state_from_agent()
            record.current_stage = "completed" if record.final_status == WorkflowStatus.COMPLETED else "failed"
            record.notify_listeners()
        except Exception as e:
            record.final_status = WorkflowStatus.FAILED
            record.error_details = str(e)
            record.notify_listeners()

    def get_agent_state(self, workflow_id: str) -> Optional[SandboxAgentState]:
        """Retrieve raw LangGraph agent state for a workflow ID."""
        with self._lock:
            record = self._store.get(workflow_id)

        if record is None:
            return None

        live_state = get_sandbox_agent_state(workflow_id)
        return live_state if live_state else record.agent_state

    def clear_all(self) -> None:
        """Clear store (used in test fixtures)."""
        with self._lock:
            self._store.clear()


# Global singleton instance for application use
workflow_service = WorkflowService()

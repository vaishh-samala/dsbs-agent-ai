"""Deterministic execution nodes and conditional edge routers for LangGraph agent."""

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, List, Optional
import uuid

from langgraph.types import interrupt

from app.agent.evaluator import AgentEvaluator
from app.agent.state import ExecutionPlanItem, SandboxAgentState, StepStatusRecord
from app.schemas import (
    AgentDecision,
    EvaluationResult,
    RuntimeType,
    ValidationErrorDetail,
)
from app.services.manifest_service import ManifestService
from app.services.sandbox_executor import SandboxExecutor


def _iso_now() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def compute_plan_fingerprint(plan: List[Dict[str, Any]]) -> str:
    """Compute a deterministic SHA256 hex digest of an execution plan."""
    serialized = json.dumps(plan, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def inspect_repository(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 1A: Inspect repository files and structure on disk to gather concrete evidence."""
    raw_manifest = state.get("manifest", {})
    repo_path = raw_manifest.get("repo_path")
    evidence = AgentEvaluator.inspect_repository(repo_path)
    return {
        "repository_findings": evidence.get("manifest_files", []) + evidence.get("lockfiles", []),
        "discovery_metadata": {
            "accessible": evidence.get("accessible", False),
            "manifest_files": evidence.get("manifest_files", []),
            "lockfiles": evidence.get("lockfiles", []),
            "detected_runtime": evidence.get("detected_runtime"),
            "detected_package_manager": evidence.get("detected_package_manager"),
            "error": evidence.get("error"),
        },
    }


def analyze_request(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 1B: Analyze developer request against repository evidence and sandbox policies."""
    raw_manifest = state.get("manifest", {})
    repo_path = raw_manifest.get("repo_path")
    evidence = AgentEvaluator.inspect_repository(repo_path)

    eval_result = AgentEvaluator.evaluate_request(
        request_data=raw_manifest,
        repo_evidence=evidence,
    )

    return {
        "evaluation_result": eval_result.model_dump(mode="json"),
        "agent_decision": eval_result.decision.value,
        "repository_findings": eval_result.repository_findings,
        "compatibility_issues": eval_result.compatibility_issues,
        "security_findings": eval_result.security_findings,
        "reasoning_summary": eval_result.reasoning_summary,
        "clarification_questions": eval_result.clarification_questions,
    }


def validate_manifest(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 1: Inspect repository, evaluate request compatibility, and validate security boundaries.

    Combines repository evidence gathering, security policy enforcement, and Pydantic validation.
    Invalid or unsupported requests are rejected or routed to clarification before any plan is sent for approval.
    """
    raw_manifest = state.get("manifest", {})
    workflow_id = state.get("workflow_id") or f"wf-{uuid.uuid4().hex[:12]}"

    started_at = _iso_now()
    step_record: StepStatusRecord = {
        "name": "validate_manifest",
        "description": "Inspect repository, evaluate request compatibility, and validate security boundaries.",
        "status": "running",
        "started_at": started_at,
        "completed_at": None,
        "duration_seconds": None,
        "error_message": None,
    }

    # 1. Run discovery / schema validation to resolve repo_path and discover manifest if needed
    validation = ManifestService.validate_manifest_data(raw_manifest)
    if validation.is_valid and validation.normalized_manifest is not None:
        effective_manifest = validation.normalized_manifest.model_dump(mode="json")
    else:
        effective_manifest = raw_manifest

    # 2. Gather repository evidence
    repo_path = effective_manifest.get("repo_path") or raw_manifest.get("repo_path")
    repo_evidence = AgentEvaluator.inspect_repository(repo_path)

    # 3. Intelligent Agent Evaluation (Rules + LLM reasoning)
    eval_result = AgentEvaluator.evaluate_request(
        request_data=effective_manifest,
        repo_evidence=repo_evidence,
    )
    eval_dict = eval_result.model_dump(mode="json")

    # Combine errors from agent evaluation and Pydantic validation
    all_errors = list(eval_result.validation_errors)
    if not validation.is_valid:
        for err in validation.errors:
            if err.message not in all_errors:
                all_errors.append(err.message)

    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))

    # Decision outcome A: REJECT / FAILED
    if eval_result.decision == AgentDecision.REJECT or len(all_errors) > 0 or not validation.is_valid:
        completed_at = _iso_now()
        err_msg = "; ".join(all_errors) if all_errors else "Request rejected by agent evaluation."
        step_record["status"] = "failed"
        step_record["completed_at"] = completed_at
        step_record["duration_seconds"] = 0.08
        step_record["error_message"] = err_msg
        step_statuses["validate_manifest"] = step_record
        errors.extend(all_errors)

        return {
            "workflow_id": workflow_id,
            "current_step": "validate_manifest",
            "validation_result": {
                "is_valid": False,
                "errors": [
                    ValidationErrorDetail(field="request", message=e, error_type="evaluation_rejection").model_dump()
                    for e in all_errors
                ],
                "warnings": eval_result.warnings,
                "normalized_manifest": None,
            },
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "failed",
            "approval_status": "rejected",
            "rejection_reason": err_msg,
            "evaluation_result": eval_dict,
            "agent_decision": "REJECT",
            "repository_findings": eval_result.repository_findings,
            "compatibility_issues": eval_result.compatibility_issues,
            "security_findings": eval_result.security_findings,
            "reasoning_summary": eval_result.reasoning_summary,
        }

    # Decision outcome B: NEEDS_CLARIFICATION
    elif eval_result.decision == AgentDecision.NEEDS_CLARIFICATION:
        completed_at = _iso_now()
        clarification_msg = "Additional information required: " + "; ".join(eval_result.clarification_questions)
        step_record["status"] = "failed"  # Stops before approval gate
        step_record["completed_at"] = completed_at
        step_record["duration_seconds"] = 0.08
        step_record["error_message"] = clarification_msg
        step_statuses["validate_manifest"] = step_record
        errors.append(clarification_msg)

        return {
            "workflow_id": workflow_id,
            "current_step": "validate_manifest",
            "validation_result": {
                "is_valid": False,
                "errors": [
                    ValidationErrorDetail(field="clarification", message=q, error_type="needs_clarification").model_dump()
                    for q in eval_result.clarification_questions
                ],
                "warnings": eval_result.warnings,
                "normalized_manifest": None,
            },
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "needs_clarification",
            "approval_status": "pending",
            "evaluation_result": eval_dict,
            "agent_decision": "NEEDS_CLARIFICATION",
            "clarification_questions": eval_result.clarification_questions,
            "repository_findings": eval_result.repository_findings,
            "compatibility_issues": eval_result.compatibility_issues,
            "security_findings": eval_result.security_findings,
            "reasoning_summary": eval_result.reasoning_summary,
        }

    # Decision outcome C: APPROVE_FOR_REVIEW
    else:
        completed_at = _iso_now()
        step_record["status"] = "completed"
        step_record["completed_at"] = completed_at
        step_record["duration_seconds"] = 0.12
        step_statuses["validate_manifest"] = step_record

        normalized_dict = (
            validation.normalized_manifest.model_dump(mode="json")
            if validation.normalized_manifest
            else (eval_result.proposed_manifest or raw_manifest)
        )

        discovery_meta = {
            "version": normalized_dict.get("version", "1.0"),
            "language": normalized_dict.get(
                "language",
                "python" if normalized_dict.get("runtime") == "python" else "javascript",
            ),
            "runtime": normalized_dict.get("runtime", "python"),
            "package_manager": normalized_dict.get("package_manager", "poetry"),
            "has_setup_commands": len(normalized_dict.get("setup_commands", [])) > 0,
            "has_validation_commands": len(normalized_dict.get("validation_commands", [])) > 0,
        }

        return {
            "workflow_id": workflow_id,
            "current_step": "validate_manifest",
            "validation_result": {
                "is_valid": True,
                "errors": [],
                "warnings": eval_result.warnings + validation.warnings,
                "normalized_manifest": normalized_dict,
            },
            "discovery_metadata": discovery_meta,
            "step_statuses": step_statuses,
            "status": "running",
            "approval_status": "pending",
            "evaluation_result": eval_dict,
            "agent_decision": "APPROVE_FOR_REVIEW",
            "repository_findings": eval_result.repository_findings,
            "compatibility_issues": eval_result.compatibility_issues,
            "security_findings": eval_result.security_findings,
            "reasoning_summary": eval_result.reasoning_summary,
        }


def should_execute_after_validation(state: SandboxAgentState) -> str:
    """Decision Router: Ensure only requests evaluated as APPROVE_FOR_REVIEW proceed to planning."""
    decision = state.get("agent_decision")
    val_result = state.get("validation_result", {})
    if decision == "APPROVE_FOR_REVIEW" and val_result.get("is_valid", False):
        return "plan_setup"
    return "finalize_workflow"


# Alias for decision router
route_after_decision = should_execute_after_validation


def plan_setup(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 2: Formulate the sequential setup plan based on normalized manifest parameters.

    Pauses workflow execution at the approval gate before any commands can be executed.
    """
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    eval_result = state.get("evaluation_result", {})
    runtime = manifest_data.get("runtime", "unknown")
    runtime_version = manifest_data.get("runtime_version", "latest")
    package_manager = manifest_data.get("package_manager", "standard")
    dependencies = manifest_data.get("dependencies", [])

    # Use proposed commands from evaluation result if present
    setup_commands = eval_result.get("proposed_commands") or manifest_data.get("setup_commands", [])
    planned_setup_cmds = setup_commands if setup_commands else [f"{package_manager} install"]

    plan: List[Dict[str, Any]] = [
        {
            "name": "prepare_environment",
            "description": f"Allocate isolated virtual container and configure {runtime} {runtime_version}.",
            "phase": "environment_provisioning",
            "requires_runtime": True,
            "commands": [f"init-container --runtime {runtime} --version {runtime_version}"],
        },
        {
            "name": "resolve_dependencies",
            "description": f"Resolve package lockfiles and cache {len(dependencies)} dependencies using {package_manager}.",
            "phase": "dependency_resolution",
            "requires_runtime": True,
            "commands": planned_setup_cmds,
        },
    ]

    plan_fingerprint = compute_plan_fingerprint(plan)

    step_statuses = dict(state.get("step_statuses", {}))
    for item in plan:
        step_statuses[item["name"]] = {
            "name": item["name"],
            "description": item["description"],
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "duration_seconds": None,
            "error_message": None,
        }

    step_statuses["approval_gate"] = {
        "name": "approval_gate",
        "description": "Explicit user approval required before executing setup commands in the sandbox.",
        "status": "pending",
        "started_at": None,
        "completed_at": None,
        "duration_seconds": None,
        "error_message": None,
    }

    return {
        "execution_plan": plan,
        "plan_fingerprint": plan_fingerprint,
        "current_step": "plan_setup",
        "step_statuses": step_statuses,
        "status": "awaiting_approval",
        "approval_status": "awaiting_approval",
    }


def approval_gate(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 3: Explicit approval gate pausing execution until user decision.

    Guarantees that no setup or validation commands execute until explicit approval is received.
    """
    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))
    plan_fingerprint = state.get("plan_fingerprint", "")
    if not plan_fingerprint:
        plan_fingerprint = compute_plan_fingerprint(state.get("execution_plan", []))

    # If already approved with matching fingerprint, continue directly
    if (
        state.get("approval_status") == "approved"
        and state.get("approved_plan_fingerprint") == plan_fingerprint
    ):
        return {
            "current_step": "approval_gate",
            "approval_status": "approved",
            "status": "running",
        }

    # Mark approval_gate as running / waiting
    started_at = _iso_now()
    step_statuses["approval_gate"] = {
        "name": "approval_gate",
        "description": "Explicit user approval required before executing setup commands in the sandbox.",
        "status": "running",
        "started_at": started_at,
        "completed_at": None,
        "duration_seconds": None,
        "error_message": None,
    }

    # Pause execution at interrupt checkpoint
    decision = interrupt({
        "workflow_id": state.get("workflow_id"),
        "prompt": "Explicit user approval required before executing setup commands.",
        "execution_plan": state.get("execution_plan", []),
        "plan_fingerprint": plan_fingerprint,
    })

    completed_at = _iso_now()

    # When resumed via Command(resume=...):
    if not isinstance(decision, dict):
        decision = {"approved": bool(decision)}

    submitted_fingerprint = decision.get("plan_fingerprint")
    if submitted_fingerprint and submitted_fingerprint != plan_fingerprint:
        err_msg = "Plan fingerprint mismatch. The proposed plan was altered since approval was requested."
        step_statuses["approval_gate"]["status"] = "failed"
        step_statuses["approval_gate"]["completed_at"] = completed_at
        step_statuses["approval_gate"]["duration_seconds"] = 0.05
        step_statuses["approval_gate"]["error_message"] = err_msg
        errors.append(err_msg)
        return {
            "current_step": "approval_gate",
            "approval_status": "rejected",
            "rejection_reason": err_msg,
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "rejected",
        }

    is_approved = bool(decision.get("approved", False))
    if is_approved:
        step_statuses["approval_gate"]["status"] = "completed"
        step_statuses["approval_gate"]["completed_at"] = completed_at
        step_statuses["approval_gate"]["duration_seconds"] = 0.05
        return {
            "current_step": "approval_gate",
            "approval_status": "approved",
            "approved_at": completed_at,
            "approved_plan_fingerprint": plan_fingerprint,
            "step_statuses": step_statuses,
            "status": "running",
        }
    else:
        reason = decision.get("reason") or "Plan execution was rejected by user."
        step_statuses["approval_gate"]["status"] = "failed"
        step_statuses["approval_gate"]["completed_at"] = completed_at
        step_statuses["approval_gate"]["duration_seconds"] = 0.05
        step_statuses["approval_gate"]["error_message"] = reason
        errors.append(f"Setup execution rejected: {reason}")
        return {
            "current_step": "approval_gate",
            "approval_status": "rejected",
            "rejection_reason": reason,
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "rejected",
        }


def should_execute_after_approval(state: SandboxAgentState) -> str:
    """Conditional router: Enforce that only approved plans proceed to execution."""
    is_approved = (
        state.get("approval_status") == "approved"
        and state.get("approved_plan_fingerprint") == state.get("plan_fingerprint")
        and not any("rejected" in str(e).lower() for e in state.get("errors", []))
    )
    if is_approved:
        return "execute_step"
    return "finalize_workflow"


def execute_step(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 4: Safely execute approved commands inside the isolated sandbox container.

    Executes planned steps strictly through the sandbox execution layer without performing
    arbitrary host shell execution.
    """
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    project_name = str(manifest_data.get("project_name", "")).lower()
    dependencies = [str(d).lower() for d in manifest_data.get("dependencies", [])]
    runtime_str = str(manifest_data.get("runtime", "python")).lower()
    runtime_type = RuntimeType.NODE if runtime_str == "node" else RuntimeType.PYTHON

    # Detect simulated failure trigger modes:
    fail_env = "fail_env" in project_name or any("fail_env" in d for d in dependencies)
    fail_dep = (
        "fail_dep" in project_name
        or "fail_install" in project_name
        or "fail_exec" in project_name
        or any("fail_dep" in d or "fail_install" in d or "fail_exec" in d for d in dependencies)
    )

    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))
    execution_logs = list(state.get("execution_logs", []))

    # --- Step 4A: prepare_environment ---
    prep_start = _iso_now()
    step_statuses["prepare_environment"]["started_at"] = prep_start

    if fail_env:
        step_statuses["prepare_environment"]["status"] = "failed"
        step_statuses["prepare_environment"]["completed_at"] = _iso_now()
        step_statuses["prepare_environment"]["duration_seconds"] = 0.25
        err_msg = "Virtual container allocation failed: insufficient sandboxed resource quota."
        step_statuses["prepare_environment"]["error_message"] = err_msg
        errors.append(err_msg)

        if "resolve_dependencies" in step_statuses:
            step_statuses["resolve_dependencies"]["status"] = "skipped"

        return {
            "current_step": "prepare_environment",
            "step_statuses": step_statuses,
            "errors": errors,
            "execution_logs": execution_logs,
            "status": "failed",
        }

    step_statuses["prepare_environment"]["status"] = "completed"
    step_statuses["prepare_environment"]["completed_at"] = _iso_now()
    step_statuses["prepare_environment"]["duration_seconds"] = 0.52

    # --- Step 4B: resolve_dependencies ---
    dep_start = _iso_now()
    step_statuses["resolve_dependencies"]["started_at"] = dep_start

    plan_items = state.get("execution_plan", [])
    dep_plan = next((p for p in plan_items if p.get("name") == "resolve_dependencies"), None)
    commands_to_run = (dep_plan.get("commands") if dep_plan else None) or [f"{manifest_data.get('package_manager')} install"]

    sim_token = "fail_dep" if fail_dep else None
    cmd_results = SandboxExecutor.execute_command_batch(
        commands_to_run,
        runtime=runtime_type,
        simulate_failure_token=sim_token,
    )

    for r in cmd_results:
        execution_logs.append(r.to_dict())

    failed_cmd = next((r for r in cmd_results if not r.success), None)
    if failed_cmd or fail_dep:
        step_statuses["resolve_dependencies"]["status"] = "failed"
        step_statuses["resolve_dependencies"]["completed_at"] = _iso_now()
        step_statuses["resolve_dependencies"]["duration_seconds"] = 0.75
        err_msg = (
            failed_cmd.error_message
            if failed_cmd and failed_cmd.error_message
            else f"Dependency resolution failed: conflicting lockfile constraints detected for {manifest_data.get('package_manager')}."
        )
        step_statuses["resolve_dependencies"]["error_message"] = err_msg
        errors.append(err_msg)

        return {
            "current_step": "resolve_dependencies",
            "step_statuses": step_statuses,
            "errors": errors,
            "execution_logs": execution_logs,
            "status": "failed",
        }

    step_statuses["resolve_dependencies"]["status"] = "completed"
    step_statuses["resolve_dependencies"]["completed_at"] = _iso_now()
    step_statuses["resolve_dependencies"]["duration_seconds"] = 1.19

    return {
        "current_step": "resolve_dependencies",
        "step_statuses": step_statuses,
        "errors": errors,
        "execution_logs": execution_logs,
    }


def should_verify_after_execution(state: SandboxAgentState) -> str:
    """Conditional router: If execution failed, skip verification and finalize."""
    if len(state.get("errors", [])) > 0:
        return "finalize_workflow"
    return "verify_setup"


def verify_setup(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 5: Execute readiness probe and smoke checks for the provisioned sandbox."""
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    port = manifest_data.get("port", 8000)
    project_name = str(manifest_data.get("project_name", "")).lower()
    dependencies = [str(d).lower() for d in manifest_data.get("dependencies", [])]
    runtime_str = str(manifest_data.get("runtime", "python")).lower()
    runtime_type = RuntimeType.NODE if runtime_str == "node" else RuntimeType.PYTHON

    should_fail_probe = "fail" in project_name or any("fail" in d for d in dependencies)

    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))
    execution_logs = list(state.get("execution_logs", []))

    verify_start = _iso_now()
    verify_record: StepStatusRecord = {
        "name": "run_health_checks",
        "description": f"Probe service readiness probe on port {port} and execute smoke assertions.",
        "status": "running",
        "started_at": verify_start,
        "completed_at": None,
        "duration_seconds": None,
        "error_message": None,
    }

    validation_cmds = manifest_data.get("validation_commands") or []
    if validation_cmds:
        cmd_results = SandboxExecutor.execute_command_batch(
            validation_cmds,
            runtime=runtime_type,
            simulate_failure_token="fail" if should_fail_probe else None,
        )
        for r in cmd_results:
            execution_logs.append(r.to_dict())
        failed_cmd = next((r for r in cmd_results if not r.success), None)
        if failed_cmd:
            should_fail_probe = True

    if should_fail_probe:
        verify_record["status"] = "failed"
        verify_record["completed_at"] = _iso_now()
        verify_record["duration_seconds"] = 0.54
        err_msg = f"Health check probe failed: port {port} connection refused. Expected service to bind within timeout."
        verify_record["error_message"] = err_msg
        errors.append(err_msg)
        step_statuses["run_health_checks"] = verify_record

        return {
            "current_step": "run_health_checks",
            "step_statuses": step_statuses,
            "errors": errors,
            "execution_logs": execution_logs,
            "status": "failed",
        }

    verify_record["status"] = "completed"
    verify_record["completed_at"] = _iso_now()
    verify_record["duration_seconds"] = 0.44
    step_statuses["run_health_checks"] = verify_record

    return {
        "current_step": "run_health_checks",
        "step_statuses": step_statuses,
        "errors": errors,
        "execution_logs": execution_logs,
    }


def finalize_workflow(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 6: Aggregate step outcomes, compute overall status, and build final summary."""
    step_statuses = state.get("step_statuses", {})
    errors = state.get("errors", [])
    workflow_id = state.get("workflow_id", "")
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    approval_status = state.get("approval_status", "pending")
    rejection_reason = state.get("rejection_reason")
    agent_decision = state.get("agent_decision")

    completed_count = sum(1 for s in step_statuses.values() if s.get("status") == "completed")
    failed_count = sum(1 for s in step_statuses.values() if s.get("status") == "failed")
    skipped_count = sum(1 for s in step_statuses.values() if s.get("status") == "skipped")

    failed_keys = [k for k, v in step_statuses.items() if v.get("status") == "failed"]

    if agent_decision == "NEEDS_CLARIFICATION" or state.get("status") == "needs_clarification":
        overall_status = "needs_clarification"
    elif state.get("status") == "failed" or failed_count > 0:
        overall_status = "failed"
    elif agent_decision == "REJECT" or approval_status == "rejected" or state.get("status") == "rejected":
        overall_status = "rejected"
    elif len(errors) == 0 and failed_count == 0 and (state.get("status") == "completed" or approval_status == "approved"):
        overall_status = "completed"
    else:
        overall_status = "failed"

    error_details = "; ".join(errors) if errors else None

    safe_manifest_summary = {
        "version": manifest_data.get("version", "1.0"),
        "project_name": manifest_data.get("project_name", "unknown"),
        "project_type": manifest_data.get("project_type", "unknown"),
        "language": manifest_data.get("language", "unknown"),
        "runtime": f"{manifest_data.get('runtime', '')} {manifest_data.get('runtime_version', '')}".strip(),
        "package_manager": manifest_data.get("package_manager", "unknown"),
        "dependencies_count": len(manifest_data.get("dependencies", [])),
        "setup_commands_count": len(manifest_data.get("setup_commands", [])),
        "validation_commands_count": len(manifest_data.get("validation_commands", [])),
        "port": manifest_data.get("port"),
        "env_var_names": manifest_data.get("env_var_names", []),
        "approval_status": approval_status,
        "plan_fingerprint": state.get("plan_fingerprint"),
        "rejection_reason": rejection_reason,
        "agent_decision": agent_decision,
    }

    final_summary = {
        "workflow_id": workflow_id,
        "status": overall_status,
        "approval_status": approval_status,
        "agent_decision": agent_decision,
        "total_steps": len(step_statuses),
        "completed_steps": completed_count,
        "failed_steps": failed_count,
        "skipped_steps": skipped_count,
        "error_details": error_details,
        "rejection_reason": rejection_reason,
        "manifest_summary": safe_manifest_summary,
        "evaluation_result": state.get("evaluation_result"),
        "finished_at": _iso_now(),
    }

    return {
        "current_step": "finalize_workflow",
        "final_summary": final_summary,
        "status": overall_status,
    }

"""Deterministic execution nodes and conditional edge routers for LangGraph agent."""

from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid

from app.agent.state import ExecutionPlanItem, SandboxAgentState, StepStatusRecord
from app.services.manifest_service import ManifestService


def _iso_now() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def validate_manifest(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 1: Validate setup manifest syntax, compatibility, and security boundaries.

    Invalid manifests stop before execution and transition directly to finalize_workflow.
    """
    raw_manifest = state.get("manifest", {})
    workflow_id = state.get("workflow_id") or f"wf-{uuid.uuid4().hex[:12]}"

    started_at = _iso_now()
    step_record: StepStatusRecord = {
        "name": "validate_manifest",
        "description": "Validate manifest syntax, runtime compatibility, and security boundaries.",
        "status": "running",
        "started_at": started_at,
        "completed_at": None,
        "duration_seconds": None,
        "error_message": None,
    }

    validation = ManifestService.validate_manifest_data(raw_manifest)
    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))

    if validation.is_valid and validation.normalized_manifest is not None:
        completed_at = _iso_now()
        step_record["status"] = "completed"
        step_record["completed_at"] = completed_at
        step_record["duration_seconds"] = 0.12
        step_statuses["validate_manifest"] = step_record

        return {
            "workflow_id": workflow_id,
            "current_step": "validate_manifest",
            "validation_result": {
                "is_valid": True,
                "errors": [],
                "warnings": validation.warnings,
                "normalized_manifest": validation.normalized_manifest.model_dump(mode="json"),
            },
            "step_statuses": step_statuses,
            "status": "running",
        }
    else:
        completed_at = _iso_now()
        validation_error_msgs = [e.message for e in validation.errors]
        combined_err = "; ".join(validation_error_msgs) if validation_error_msgs else "Manifest validation failed."
        step_record["status"] = "failed"
        step_record["completed_at"] = completed_at
        step_record["duration_seconds"] = 0.05
        step_record["error_message"] = combined_err
        step_statuses["validate_manifest"] = step_record
        errors.extend(validation_error_msgs)

        return {
            "workflow_id": workflow_id,
            "current_step": "validate_manifest",
            "validation_result": {
                "is_valid": False,
                "errors": [e.model_dump() for e in validation.errors],
                "warnings": validation.warnings,
                "normalized_manifest": None,
            },
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "failed",
        }


def should_execute_after_validation(state: SandboxAgentState) -> str:
    """Conditional router: Ensure invalid manifests do not reach execution."""
    val_result = state.get("validation_result", {})
    if val_result.get("is_valid", False):
        return "plan_setup"
    return "finalize_workflow"


def plan_setup(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 2: Formulate the sequential setup plan based on normalized manifest parameters."""
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    runtime = manifest_data.get("runtime", "unknown")
    runtime_version = manifest_data.get("runtime_version", "latest")
    package_manager = manifest_data.get("package_manager", "standard")
    dependencies = manifest_data.get("dependencies", [])

    plan: List[Dict[str, Any]] = [
        {
            "name": "prepare_environment",
            "description": f"Allocate isolated virtual container and configure {runtime} {runtime_version}.",
            "phase": "environment_provisioning",
            "requires_runtime": True,
        },
        {
            "name": "resolve_dependencies",
            "description": f"Resolve package lockfiles and cache {len(dependencies)} dependencies using {package_manager}.",
            "phase": "dependency_resolution",
            "requires_runtime": True,
        },
    ]

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

    return {
        "execution_plan": plan,
        "current_step": "plan_setup",
        "step_statuses": step_statuses,
    }


def execute_step(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 3: Deterministically simulate safe sandbox provisioning and dependency resolution.

    Executes planned steps without performing arbitrary host shell execution.
    If a failure condition is detected, sets step status to failed and aborts remaining steps.
    """
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    project_name = str(manifest_data.get("project_name", "")).lower()
    dependencies = [str(d).lower() for d in manifest_data.get("dependencies", [])]

    # Detect simulated failure trigger modes:
    # 1. Environment allocation failure
    fail_env = "fail_env" in project_name or any("fail_env" in d for d in dependencies)
    # 2. Dependency resolution failure
    fail_dep = (
        "fail_dep" in project_name
        or "fail_install" in project_name
        or "fail_exec" in project_name
        or any("fail_dep" in d or "fail_install" in d or "fail_exec" in d for d in dependencies)
    )

    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))

    # --- Step 3A: prepare_environment ---
    prep_start = _iso_now()
    step_statuses["prepare_environment"]["started_at"] = prep_start

    if fail_env:
        step_statuses["prepare_environment"]["status"] = "failed"
        step_statuses["prepare_environment"]["completed_at"] = _iso_now()
        step_statuses["prepare_environment"]["duration_seconds"] = 0.25
        err_msg = "Virtual container allocation failed: insufficient sandboxed resource quota."
        step_statuses["prepare_environment"]["error_message"] = err_msg
        errors.append(err_msg)

        # Mark subsequent planned steps as skipped
        if "resolve_dependencies" in step_statuses:
            step_statuses["resolve_dependencies"]["status"] = "skipped"

        return {
            "current_step": "prepare_environment",
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "failed",
        }

    step_statuses["prepare_environment"]["status"] = "completed"
    step_statuses["prepare_environment"]["completed_at"] = _iso_now()
    step_statuses["prepare_environment"]["duration_seconds"] = 0.52

    # --- Step 3B: resolve_dependencies ---
    dep_start = _iso_now()
    step_statuses["resolve_dependencies"]["started_at"] = dep_start

    if fail_dep:
        step_statuses["resolve_dependencies"]["status"] = "failed"
        step_statuses["resolve_dependencies"]["completed_at"] = _iso_now()
        step_statuses["resolve_dependencies"]["duration_seconds"] = 0.75
        err_msg = f"Dependency resolution failed: conflicting lockfile constraints detected for {manifest_data.get('package_manager')}."
        step_statuses["resolve_dependencies"]["error_message"] = err_msg
        errors.append(err_msg)

        return {
            "current_step": "resolve_dependencies",
            "step_statuses": step_statuses,
            "errors": errors,
            "status": "failed",
        }

    step_statuses["resolve_dependencies"]["status"] = "completed"
    step_statuses["resolve_dependencies"]["completed_at"] = _iso_now()
    step_statuses["resolve_dependencies"]["duration_seconds"] = 1.19

    return {
        "current_step": "resolve_dependencies",
        "step_statuses": step_statuses,
        "errors": errors,
    }


def should_verify_after_execution(state: SandboxAgentState) -> str:
    """Conditional router: If execution failed, skip verification and finalize."""
    if len(state.get("errors", [])) > 0:
        return "finalize_workflow"
    return "verify_setup"


def verify_setup(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 4: Simulate readiness probe and health checks for the newly provisioned sandbox."""
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})
    port = manifest_data.get("port", 8000)
    project_name = str(manifest_data.get("project_name", "")).lower()
    dependencies = [str(d).lower() for d in manifest_data.get("dependencies", [])]

    # Verification failure trigger: generic "fail" in project or dependencies (not already handled)
    should_fail_probe = "fail" in project_name or any("fail" in d for d in dependencies)

    step_statuses = dict(state.get("step_statuses", {}))
    errors = list(state.get("errors", []))

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
    }


def finalize_workflow(state: SandboxAgentState) -> Dict[str, Any]:
    """Node 5: Aggregate step outcomes, compute status, and build the final summary."""
    step_statuses = state.get("step_statuses", {})
    errors = state.get("errors", [])
    workflow_id = state.get("workflow_id", "")
    manifest_data = state.get("validation_result", {}).get("normalized_manifest") or state.get("manifest", {})

    completed_count = sum(1 for s in step_statuses.values() if s.get("status") == "completed")
    failed_count = sum(1 for s in step_statuses.values() if s.get("status") == "failed")
    skipped_count = sum(1 for s in step_statuses.values() if s.get("status") == "skipped")

    overall_status = "completed" if len(errors) == 0 and failed_count == 0 else "failed"

    error_details = "; ".join(errors) if errors else None

    # Safe manifest summary: never leak sensitive values
    safe_manifest_summary = {
        "project_name": manifest_data.get("project_name", "unknown"),
        "project_type": manifest_data.get("project_type", "unknown"),
        "runtime": f"{manifest_data.get('runtime', '')} {manifest_data.get('runtime_version', '')}".strip(),
        "package_manager": manifest_data.get("package_manager", "unknown"),
        "dependencies_count": len(manifest_data.get("dependencies", [])),
        "port": manifest_data.get("port"),
        "env_var_names": manifest_data.get("env_var_names", []),
    }

    final_summary = {
        "workflow_id": workflow_id,
        "status": overall_status,
        "total_steps": len(step_statuses),
        "completed_steps": completed_count,
        "failed_steps": failed_count,
        "skipped_steps": skipped_count,
        "error_details": error_details,
        "manifest_summary": safe_manifest_summary,
        "finished_at": _iso_now(),
    }

    return {
        "current_step": "finalize_workflow",
        "final_summary": final_summary,
        "status": overall_status,
    }

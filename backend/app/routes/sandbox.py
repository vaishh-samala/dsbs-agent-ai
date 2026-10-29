"""Sandbox bootstrap, validation, discovery, and workflow status API routes."""

import asyncio
from typing import Any, Dict, Optional
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.schemas import (
    APIErrorResponse,
    ApprovalDecisionRequest,
    ManifestDiscoveryRequest,
    ManifestDiscoveryResult,
    ValidationResult,
    WorkflowCreateResponse,
    WorkflowPlanResponse,
    WorkflowStatus,
    WorkflowStatusResponse,
)
from app.services.manifest_service import ManifestService
from app.services.workflow_service import workflow_service

router = APIRouter(prefix="/sandbox", tags=["Sandbox"])


@router.post(
    "/validate",
    response_model=ValidationResult,
    status_code=status.HTTP_200_OK,
    summary="Validate setup manifest",
    description="Validate setup manifest structure, runtime compatibility, and security constraints.",
)
async def validate_manifest(payload: Dict[str, Any]) -> ValidationResult:
    """Accept an arbitrary manifest payload, validate against schema, and return structured results."""
    return ManifestService.validate_manifest_data(payload)


@router.post(
    "/manifest/discover",
    response_model=ManifestDiscoveryResult,
    status_code=status.HTTP_200_OK,
    summary="Discover or infer setup manifest in a repository",
    description="Inspect a repository path on disk for setup manifests, inferred project files, or generate a fallback.",
)
async def discover_manifest(payload: ManifestDiscoveryRequest) -> ManifestDiscoveryResult:
    """Auto-discover or infer manifest from a repository directory path."""
    repo_path = payload.repo_path or "."
    return ManifestService.discover_manifest(repo_path)


@router.post(
    "/setup",
    response_model=WorkflowCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize sandbox setup workflow",
    description="Accept a validated setup manifest and trigger a simulated deterministic setup workflow.",
    responses={
        422: {"model": APIErrorResponse, "description": "Validation error in manifest"},
    },
)
async def create_sandbox_setup(payload: Dict[str, Any], background: bool = False):
    """Validate manifest and initialize a simulated sandbox bootstrap workflow."""
    validation = ManifestService.validate_manifest_data(payload)
    if not validation.is_valid or validation.normalized_manifest is None:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=APIErrorResponse(
                detail="Manifest validation failed. Correct the listed field errors before initiating setup.",
                error_code="MANIFEST_VALIDATION_FAILED",
                errors=validation.errors,
            ).model_dump(mode="json"),
        )

    # Initialize simulated deterministic workflow
    return workflow_service.create_workflow(validation.normalized_manifest, background=background)


@router.get(
    "/status/{workflow_id}",
    response_model=WorkflowStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get workflow status",
    description="Fetch current progress, step status details, and diagnostic timeline for a workflow.",
    responses={
        404: {"model": APIErrorResponse, "description": "Workflow ID not found"},
    },
)
async def get_workflow_status(workflow_id: str):
    """Retrieve execution status and timeline for a given workflow ID."""
    workflow = workflow_service.get_workflow(workflow_id)
    if workflow is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=APIErrorResponse(
                detail=f"Workflow with ID '{workflow_id}' not found.",
                error_code="WORKFLOW_NOT_FOUND",
            ).model_dump(mode="json"),
        )
    return workflow


@router.get(
    "/{workflow_id}/plan",
    response_model=WorkflowPlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Get proposed workflow execution plan",
    description="Fetch the pending execution plan, fingerprint, commands, and approval status.",
    responses={
        404: {"model": APIErrorResponse, "description": "Workflow ID not found"},
    },
)
@router.get(
    "/plan/{workflow_id}",
    response_model=WorkflowPlanResponse,
    include_in_schema=False,
)
async def get_workflow_plan(workflow_id: str):
    """Retrieve proposed execution plan and fingerprint for a workflow."""
    plan = workflow_service.get_workflow_plan(workflow_id)
    if plan is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=APIErrorResponse(
                detail=f"Workflow with ID '{workflow_id}' not found.",
                error_code="WORKFLOW_NOT_FOUND",
            ).model_dump(mode="json"),
        )
    return plan


@router.post(
    "/{workflow_id}/approve",
    response_model=WorkflowStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve pending execution plan",
    description="Explicitly approve the proposed plan to resume sandbox setup execution.",
    responses={
        400: {"model": APIErrorResponse, "description": "Workflow not awaiting approval"},
        404: {"model": APIErrorResponse, "description": "Workflow ID not found"},
        409: {"model": APIErrorResponse, "description": "Plan fingerprint mismatch"},
    },
)
@router.post(
    "/approve/{workflow_id}",
    response_model=WorkflowStatusResponse,
    include_in_schema=False,
)
async def approve_workflow_plan(
    workflow_id: str,
    payload: Optional[ApprovalDecisionRequest] = None,
    background: bool = False,
):
    """Approve execution plan and resume execution in the sandbox."""
    decision = payload or ApprovalDecisionRequest(approved=True)
    try:
        return workflow_service.approve_workflow(
            workflow_id=workflow_id,
            approved=True,
            reason=decision.reason,
            plan_fingerprint=decision.plan_fingerprint,
            background=background,
        )
    except KeyError:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=APIErrorResponse(
                detail=f"Workflow with ID '{workflow_id}' not found.",
                error_code="WORKFLOW_NOT_FOUND",
            ).model_dump(mode="json"),
        )
    except ValueError as e:
        err_msg = str(e)
        if "fingerprint mismatch" in err_msg.lower():
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=APIErrorResponse(
                    detail=err_msg,
                    error_code="PLAN_MISMATCH",
                ).model_dump(mode="json"),
            )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=APIErrorResponse(
                detail=err_msg,
                error_code="INVALID_WORKFLOW_STATE",
            ).model_dump(mode="json"),
        )


@router.post(
    "/{workflow_id}/reject",
    response_model=WorkflowStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject pending execution plan",
    description="Explicitly reject the proposed plan, halting execution cleanly without running commands.",
    responses={
        400: {"model": APIErrorResponse, "description": "Workflow not awaiting approval"},
        404: {"model": APIErrorResponse, "description": "Workflow ID not found"},
    },
)
@router.post(
    "/reject/{workflow_id}",
    response_model=WorkflowStatusResponse,
    include_in_schema=False,
)
async def reject_workflow_plan(
    workflow_id: str,
    payload: Optional[ApprovalDecisionRequest] = None,
):
    """Reject execution plan and halt workflow cleanly."""
    decision = payload or ApprovalDecisionRequest(approved=False)
    try:
        return workflow_service.approve_workflow(
            workflow_id=workflow_id,
            approved=False,
            reason=decision.reason,
            plan_fingerprint=decision.plan_fingerprint,
        )
    except KeyError:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=APIErrorResponse(
                detail=f"Workflow with ID '{workflow_id}' not found.",
                error_code="WORKFLOW_NOT_FOUND",
            ).model_dump(mode="json"),
        )
    except ValueError as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=APIErrorResponse(
                detail=str(e),
                error_code="INVALID_WORKFLOW_STATE",
            ).model_dump(mode="json"),
        )


@router.get(
    "/{workflow_id}/events",
    summary="Live Server-Sent Events stream for workflow progress",
    description="Streams real-time stage updates, execution progress, and diagnostics.",
)
@router.get(
    "/events/{workflow_id}",
    include_in_schema=False,
)
async def stream_workflow_events(workflow_id: str):
    """Stream real-time SSE events as the workflow progresses through stages."""
    workflow = workflow_service.get_workflow_record(workflow_id)
    if workflow is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=APIErrorResponse(
                detail=f"Workflow with ID '{workflow_id}' not found.",
                error_code="WORKFLOW_NOT_FOUND",
            ).model_dump(mode="json"),
        )

    async def event_generator():
        # 1. Send initial snapshot state
        initial_data = workflow.to_status_response().model_dump_json()
        yield f"event: status\ndata: {initial_data}\n\n"

        # 2. If already terminal, close stream
        if workflow.final_status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.REJECTED]:
            yield "event: complete\ndata: {}\n\n"
            return

        # 3. Subscribe to live updates queue
        q = workflow.subscribe()
        try:
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield f"event: update\ndata: {data}\n\n"
                    if workflow.final_status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.REJECTED]:
                        yield "event: complete\ndata: {}\n\n"
                        break
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    if workflow.final_status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.REJECTED]:
                        yield "event: complete\ndata: {}\n\n"
                        break
        finally:
            workflow.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/manifest/schema",
    summary="Get manifest JSON schema",
    description="Returns the canonical JSON schema for the SetupManifest model.",
)
async def get_manifest_schema() -> Dict[str, Any]:
    """Return JSON schema specification for client validation."""
    return ManifestService.get_manifest_schema()

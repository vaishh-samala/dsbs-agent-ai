"""Sandbox bootstrap, validation, and workflow status API routes."""

from typing import Any, Dict
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas import (
    APIErrorResponse,
    ValidationResult,
    WorkflowCreateResponse,
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
    "/setup",
    response_model=WorkflowCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize sandbox setup workflow",
    description="Accept a validated setup manifest and trigger a simulated deterministic setup workflow.",
    responses={
        422: {"model": APIErrorResponse, "description": "Validation error in manifest"},
    },
)
async def create_sandbox_setup(payload: Dict[str, Any]):
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
    return workflow_service.create_workflow(validation.normalized_manifest)


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
    "/manifest/schema",
    summary="Get manifest JSON schema",
    description="Returns the canonical JSON schema for the SetupManifest model.",
)
async def get_manifest_schema() -> Dict[str, Any]:
    """Return JSON schema specification for client validation."""
    return ManifestService.get_manifest_schema()

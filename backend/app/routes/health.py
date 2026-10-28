"""Health check route."""

from fastapi import APIRouter
from app.core.config import settings
from app.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check probe",
    description="Returns operational status and API version of the sandbox bootstrapper service.",
)
async def get_health() -> HealthResponse:
    """Return service health status and API version."""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        service=settings.APP_NAME,
    )

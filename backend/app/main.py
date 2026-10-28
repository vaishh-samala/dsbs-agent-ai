"""FastAPI application entry point for Developer Sandbox Bootstrapper."""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routes import health, sandbox
from app.schemas import APIErrorResponse, ValidationErrorDetail


def create_application() -> FastAPI:
    """Application factory for FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Backend API for validating manifests and simulating developer sandbox bootstrapping.",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Safe CORS Middleware configuration:
    # Wildcard origin '*' is incompatible with allow_credentials=True in Starlette / CORS spec
    origins = settings.CORS_ORIGINS
    allow_credentials = "*" not in origins

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if isinstance(origins, list) else [origins],
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global handler for HTTPException to guarantee APIErrorResponse schema consistency
    @app.exception_handler(HTTPException)
    async def custom_http_exception_handler(request: Request, exc: HTTPException):
        detail_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        error_code = f"HTTP_{exc.status_code}"
        return JSONResponse(
            status_code=exc.status_code,
            content=APIErrorResponse(
                detail=detail_msg,
                error_code=error_code,
            ).model_dump(mode="json"),
        )

    # Global handler for RequestValidationError to guarantee APIErrorResponse schema consistency
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = [
            ValidationErrorDetail(
                field=" -> ".join(str(p) for p in err["loc"][1:]) if len(err["loc"]) > 1 else str(err["loc"][0]),
                message=err["msg"],
                error_type=err.get("type", "value_error"),
            )
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=APIErrorResponse(
                detail="Request body validation failed.",
                error_code="REQUEST_VALIDATION_ERROR",
                errors=errors,
            ).model_dump(mode="json"),
        )

    # Include route modules
    app.include_router(health.router)
    app.include_router(sandbox.router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

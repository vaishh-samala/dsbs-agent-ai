"""Pydantic data schemas for manifest validation and workflow orchestration."""

from datetime import datetime, timezone
from enum import Enum
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProjectType(str, Enum):
    """Allowed project archetypes."""
    NODE_APP = "node_app"
    PYTHON_APP = "python_app"
    FASTAPI_SERVICE = "fastapi_service"
    NEXTJS_APP = "nextjs_app"
    EXPRESS_API = "express_api"
    DJANGO_APP = "django_app"


class RuntimeType(str, Enum):
    """Allowed runtime environments."""
    NODE = "node"
    PYTHON = "python"


class PackageManager(str, Enum):
    """Allowed package managers."""
    # Node package managers
    NPM = "npm"
    PNPM = "pnpm"
    YARN = "yarn"
    BUN = "bun"
    # Python package managers
    PIP = "pip"
    POETRY = "poetry"
    UV = "uv"


class StepStatus(str, Enum):
    """Status lifecycle of an individual workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStatus(str, Enum):
    """Overall status of a setup workflow."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Valid identifier regex for project name and env var names
NAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
ENV_VAR_REGEX = re.compile(r"^[A-Z_][A-Z0-9_]*$")


class SetupManifest(BaseModel):
    """Setup manifest defining environment configuration and dependencies."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    project_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the project containing only alphanumeric chars, underscores, hyphens, and periods.",
        examples=["fastapi-microservice", "nextjs-taxonomy"],
    )
    project_type: ProjectType = Field(
        ...,
        description="Supported project archetype.",
        examples=[ProjectType.FASTAPI_SERVICE],
    )
    runtime: RuntimeType = Field(
        ...,
        description="Core language runtime.",
        examples=[RuntimeType.PYTHON],
    )
    runtime_version: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Specific runtime version string.",
        examples=["3.11.9", "20.14.0"],
    )
    package_manager: PackageManager = Field(
        ...,
        description="Package manager used to install dependencies.",
        examples=[PackageManager.POETRY],
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="List of declared dependencies and version constraints.",
        examples=[["fastapi>=0.111.0", "uvicorn[standard]>=0.29.0"]],
    )
    env_var_names: List[str] = Field(
        default_factory=list,
        description="List of required environment variable names (keys only, never secrets or values).",
        examples=[["PORT", "DATABASE_URL"]],
    )
    setup_steps: List[str] = Field(
        default_factory=lambda: [
            "validate_manifest",
            "prepare_environment",
            "resolve_dependencies",
            "run_health_checks",
        ],
        description="List of deterministic setup pipeline step names.",
    )
    port: Optional[int] = Field(
        default=None,
        ge=1024,
        le=65535,
        description="Bound network port for the sandbox service.",
        examples=[8000],
    )
    start_command: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Optional command to start the sandbox application.",
        examples=["poetry run uvicorn main:app --port 8000"],
    )
    test_command: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Optional command to run the project smoke/unit test suite.",
        examples=["poetry run pytest"],
    )
    repo_url: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Optional Git repository source URL.",
        examples=["https://github.com/tiangolo/fastapi-realworld-example"],
    )
    branch: Optional[str] = Field(
        default="main",
        max_length=100,
        description="Git branch name.",
        examples=["main"],
    )

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, v: str) -> str:
        clean = v.strip()
        if not NAME_REGEX.match(clean):
            raise ValueError(
                "project_name must contain only alphanumeric characters, underscores, hyphens, and periods."
            )
        return clean

    @field_validator("env_var_names")
    @classmethod
    def validate_env_var_names(cls, v: List[str]) -> List[str]:
        cleaned: List[str] = []
        for name in v:
            clean = name.strip()
            # Mask and reject any value assignment without reflecting secrets in the error message
            if "=" in clean:
                var_key = clean.split("=")[0].strip() or "VARIABLE"
                raise ValueError(
                    f"Invalid environment variable '{var_key}'. Only variable names are accepted, never values or secret assignments."
                )
            if not ENV_VAR_REGEX.match(clean):
                raise ValueError(
                    f"Invalid environment variable name '{clean}'. Names must start with an uppercase letter or underscore and contain only A-Z, 0-9, and underscores."
                )
            cleaned.append(clean)
        return cleaned

    @model_validator(mode="after")
    def validate_runtime_and_package_manager_compatibility(self) -> "SetupManifest":
        """Verify that the package manager and project type match the selected runtime."""
        node_pms = {PackageManager.NPM, PackageManager.PNPM, PackageManager.YARN, PackageManager.BUN}
        python_pms = {PackageManager.PIP, PackageManager.POETRY, PackageManager.UV}

        if self.runtime == RuntimeType.NODE:
            if self.package_manager not in node_pms:
                raise ValueError(
                    f"Package manager '{self.package_manager.value}' is incompatible with Node.js runtime. Supported: {', '.join(sorted(pm.value for pm in node_pms))}."
                )
            if self.project_type in {ProjectType.PYTHON_APP, ProjectType.FASTAPI_SERVICE, ProjectType.DJANGO_APP}:
                raise ValueError(
                    f"Project type '{self.project_type.value}' requires a Python runtime, but 'node' was provided."
                )
            if self.port is None:
                self.port = 3000

        elif self.runtime == RuntimeType.PYTHON:
            if self.package_manager not in python_pms:
                raise ValueError(
                    f"Package manager '{self.package_manager.value}' is incompatible with Python runtime. Supported: {', '.join(sorted(pm.value for pm in python_pms))}."
                )
            if self.project_type in {ProjectType.NODE_APP, ProjectType.NEXTJS_APP, ProjectType.EXPRESS_API}:
                raise ValueError(
                    f"Project type '{self.project_type.value}' requires a Node runtime, but 'python' was provided."
                )
            if self.port is None:
                self.port = 8000

        return self


class ValidationErrorDetail(BaseModel):
    """Detailed field-level validation error."""
    field: str = Field(..., description="Field path that triggered the error.")
    message: str = Field(..., description="Clear explanation of the validation failure.")
    error_type: str = Field(..., description="Machine-readable error type identifier.")


class ValidationResult(BaseModel):
    """Structured response for manifest validation requests."""
    is_valid: bool = Field(..., description="True if manifest meets all schema and compatibility requirements.")
    errors: List[ValidationErrorDetail] = Field(default_factory=list, description="Field-level validation error list.")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings or optimization suggestions.")
    normalized_manifest: Optional[SetupManifest] = Field(
        default=None,
        description="Sanitized and normalized manifest model if validation passed.",
    )


class WorkflowStep(BaseModel):
    """Individual phase in the setup pipeline."""
    name: str = Field(..., description="Step identifier.")
    description: str = Field(..., description="Human-readable step objective.")
    status: StepStatus = Field(default=StepStatus.PENDING, description="Current execution state.")
    started_at: Optional[datetime] = Field(default=None, description="Step commencement timestamp.")
    completed_at: Optional[datetime] = Field(default=None, description="Step completion timestamp.")
    duration_seconds: Optional[float] = Field(default=None, description="Elapsed time in seconds.")
    error_message: Optional[str] = Field(default=None, description="Diagnostic error details if step failed.")


class WorkflowCreateResponse(BaseModel):
    """Response returned upon successful workflow initialization."""
    workflow_id: str = Field(..., description="Unique workflow identifier.")
    status: WorkflowStatus = Field(..., description="Initial workflow status.")
    is_simulated: bool = Field(default=True, description="Indicates that execution is simulated without physical provisioning.")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    steps: List[WorkflowStep] = Field(..., description="Initial workflow step progression.")
    message: str = Field(..., description="Status summary message.")


class WorkflowStatusResponse(BaseModel):
    """Response returned when polling workflow status."""
    workflow_id: str = Field(..., description="Unique workflow identifier.")
    status: WorkflowStatus = Field(..., description="Current overall workflow status.")
    is_simulated: bool = Field(default=True, description="Indicates execution is simulated.")
    created_at: datetime = Field(..., description="Workflow creation timestamp in UTC.")
    updated_at: datetime = Field(..., description="Last status update timestamp in UTC.")
    completed_at: Optional[datetime] = Field(default=None, description="Workflow completion timestamp in UTC.")
    steps: List[WorkflowStep] = Field(..., description="Step details and execution history.")
    manifest_summary: Dict[str, Any] = Field(..., description="Safe summary of the validated manifest.")
    error_details: Optional[str] = Field(default=None, description="High-level error description if workflow failed.")


class APIErrorResponse(BaseModel):
    """Standardized error envelope for API failures."""
    detail: str = Field(..., description="Human-readable error summary.")
    error_code: str = Field(..., description="Machine-readable error code.")
    errors: Optional[List[ValidationErrorDetail]] = Field(default=None, description="Optional list of field errors.")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(default="healthy", description="Operational status.")
    version: str = Field(..., description="Semantic API version.")
    service: str = Field(..., description="Service identifier.")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Current UTC timestamp.",
    )

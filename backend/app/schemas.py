"""Pydantic data schemas for manifest validation, discovery, and workflow orchestration."""

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


class ApprovalStatus(str, Enum):
    """Status of user approval for the planned sandbox setup."""
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class StageId(str, Enum):
    """Ordered stages in the agent workflow."""
    INSPECTION = "inspection"
    PLANNING = "planning"
    APPROVAL = "approval"
    EXECUTION = "execution"
    VERIFICATION = "verification"
    FINAL_RESULT = "final_result"


class StageStatus(str, Enum):
    """Status lifecycle of an individual high-level stage."""
    PENDING = "pending"
    RUNNING = "running"
    WAITING_FOR_APPROVAL = "waiting_for_approval"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"
    SKIPPED = "skipped"
    NEEDS_CLARIFICATION = "needs_clarification"


class WorkflowStageInfo(BaseModel):
    """Structured stage item in the 6-stage live agent timeline."""
    id: str = Field(..., description="Stage identifier (e.g. inspection, planning, approval, execution, verification, final_result).")
    number: int = Field(..., description="Sequential stage index (1-6).")
    title: str = Field(..., description="Display title of the stage.")
    description: str = Field(..., description="Short explanation of what this stage accomplishes.")
    status: StageStatus = Field(default=StageStatus.PENDING, description="Execution status.")
    message: Optional[str] = Field(default=None, description="Human-readable live status message.")
    started_at: Optional[datetime] = Field(default=None, description="Timestamp stage commenced.")
    completed_at: Optional[datetime] = Field(default=None, description="Timestamp stage concluded.")
    duration_seconds: Optional[float] = Field(default=None, description="Elapsed time in seconds.")
    error_message: Optional[str] = Field(default=None, description="Error diagnostics if stage failed.")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Stage-specific contextual metadata.")


class WorkflowStatus(str, Enum):
    """Overall status of a setup workflow."""
    QUEUED = "queued"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"
    NEEDS_CLARIFICATION = "needs_clarification"


class AgentDecision(str, Enum):
    """Explicit decision outcomes produced by the agent evaluation router."""
    APPROVE_FOR_REVIEW = "APPROVE_FOR_REVIEW"
    REJECT = "REJECT"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"


class EvaluationResult(BaseModel):
    """Structured agent evaluation result containing evidence-based analysis."""
    decision: AgentDecision = Field(..., description="Evaluation decision: APPROVE_FOR_REVIEW, REJECT, or NEEDS_CLARIFICATION.")
    request_summary: str = Field(..., description="Concise synopsis of the developer request.")
    repository_findings: List[str] = Field(default_factory=list, description="Concrete evidence discovered in the repository.")
    compatibility_issues: List[str] = Field(default_factory=list, description="Identified framework, engine, or lockfile incompatibilities.")
    security_findings: List[str] = Field(default_factory=list, description="Security scan results, command policies, and permission assessments.")
    validation_errors: List[str] = Field(default_factory=list, description="Blocking validation or policy errors.")
    warnings: List[str] = Field(default_factory=list, description="Non-blocking warnings or optimization suggestions.")
    proposed_manifest: Optional[Dict[str, Any]] = Field(default=None, description="Sanitized and normalized manifest model.")
    proposed_commands: List[str] = Field(default_factory=list, description="Sequential sandbox commands scheduled for execution.")
    permission_justification: Optional[str] = Field(default=None, description="Evaluation of requested sandbox permissions and scope.")
    verification_plan: List[str] = Field(default_factory=list, description="Planned smoke probes and health assertions.")
    reasoning_summary: str = Field(..., description="High-level reasoning narrative synthesized by LLM or deterministic engine.")
    clarification_questions: List[str] = Field(default_factory=list, description="Specific questions if additional information is required.")


# Valid identifier regex for project name and env var names
NAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
ENV_VAR_REGEX = re.compile(r"^[A-Z_][A-Z0-9_]*$")

# Supported versions and languages
SUPPORTED_MANIFEST_VERSIONS = {"1.0", "1"}
SUPPORTED_LANGUAGES = {"python", "javascript", "typescript", "node"}

# Security inspection rules for sandbox command isolation
DANGEROUS_PATTERNS = [
    (re.compile(r"(^|[;&|]\s*)sudo(\s+|$)", re.IGNORECASE), "privilege escalation ('sudo')"),
    (re.compile(r"(^|[;&|]\s*)(su|doas)(\s+|$)", re.IGNORECASE), "privilege escalation"),
    (re.compile(r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s+(/|/\*|~|~/\*|\$HOME)", re.IGNORECASE), "prohibited recursive root/home deletion ('rm -rf /')"),
    (re.compile(r"(curl|wget)\s+[^;&|]*\|\s*(sh|bash|zsh)", re.IGNORECASE), "piping unverified remote script to shell"),
    (re.compile(r"(sh|bash|zsh)\s+<\s*\(\s*(curl|wget)", re.IGNORECASE), "executing unverified remote script in subshell"),
    (re.compile(r":\(\)\s*\{", re.IGNORECASE), "prohibited fork bomb expression"),
    (re.compile(r"(^|[;&|]\s*)(mkfs(\.[a-zA-Z0-9]+)?|dd(\s+|$)|shutdown|reboot)", re.IGNORECASE), "prohibited destructive host operation"),
    (re.compile(r"(nc|ncat|netcat)\s+.*-e\s+", re.IGNORECASE), "prohibited network reverse shell"),
]

NODE_TOOL_REGEX = re.compile(r"(^|[;&|]\s*)(npm|pnpm|yarn|bun)(\s+|$)", re.IGNORECASE)
PYTHON_TOOL_REGEX = re.compile(r"(^|[;&|]\s*)(pip|poetry|pytest|python|python3|uv)(\s+|$)", re.IGNORECASE)


def validate_command_security_and_compatibility(cmd: str, runtime: RuntimeType, field_name: str) -> None:
    """Ensure a command does not violate sandbox isolation policies and matches the declared runtime."""
    clean = cmd.strip()
    if not clean:
        return

    # 1. Check dangerous patterns
    for pattern, description in DANGEROUS_PATTERNS:
        if pattern.search(clean):
            raise ValueError(
                f"Command '{clean}' in {field_name} contains forbidden {description}. "
                "All commands must execute within sandbox boundaries with unprivileged permissions."
            )

    # 2. Check runtime tool compatibility
    if runtime == RuntimeType.PYTHON:
        if NODE_TOOL_REGEX.search(clean):
            raise ValueError(
                f"Command '{clean}' in {field_name} uses Node.js tooling in a Python runtime environment. "
                "Use Python tools (pip, poetry, uv, pytest)."
            )
    elif runtime == RuntimeType.NODE:
        if PYTHON_TOOL_REGEX.search(clean):
            raise ValueError(
                f"Command '{clean}' in {field_name} uses Python tooling in a Node.js runtime environment. "
                "Use Node.js tools (npm, pnpm, yarn, bun)."
            )


class SetupManifest(BaseModel):
    """Setup manifest defining environment configuration and dependencies."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    version: str = Field(
        default="1.0",
        description="Manifest schema specification version.",
        examples=["1.0"],
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
    language: Optional[str] = Field(
        default=None,
        description="Primary programming language (e.g., 'python', 'javascript', 'typescript'). Inferred if omitted.",
        examples=["python", "typescript"],
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
    environment_variables: Optional[List[str]] = Field(
        default=None,
        description="Optional alias for env_var_names (keys only, never secrets or values).",
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
    setup_commands: List[str] = Field(
        default_factory=list,
        description="Deterministic setup commands to execute within the sandbox environment.",
        examples=[["poetry install --no-root"]],
    )
    validation_commands: List[str] = Field(
        default_factory=list,
        description="Deterministic validation/test commands to execute to verify the sandbox.",
        examples=[["poetry run pytest"]],
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
    repo_path: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional local filesystem path to the repository for discovery.",
    )
    permissions: Optional[List[str]] = Field(
        default_factory=lambda: ["read_only", "sandbox_debug"],
        description="Requested sandbox permission scopes (e.g. read_only, sandbox_debug, full_ports).",
    )
    scope: Optional[str] = Field(
        default="sandbox_debug",
        description="Primary access scope requested by developer.",
    )
    network_access: Optional[str] = Field(
        default="loopback_only",
        description="Network isolation requirement (e.g. loopback_only, full_ports).",
    )
    justification: Optional[str] = Field(
        default=None,
        description="Developer explanation/justification for requested access or permissions.",
    )
    clarification_responses: Optional[Dict[str, str]] = Field(
        default=None,
        description="Developer answers to previous clarification questions.",
    )

    @field_validator("version")
    @classmethod
    def validate_manifest_version(cls, v: str) -> str:
        clean = v.strip()
        if clean not in SUPPORTED_MANIFEST_VERSIONS:
            raise ValueError(
                f"Unsupported manifest version '{clean}'. Supported manifest schema versions: {', '.join(sorted(SUPPORTED_MANIFEST_VERSIONS))}."
            )
        return clean

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().lower()
        if clean not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language '{clean}'. Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}."
            )
        return clean

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, v: str) -> str:
        clean = v.strip()
        if not NAME_REGEX.match(clean):
            raise ValueError(
                "project_name must contain only alphanumeric characters, underscores, hyphens, and periods."
            )
        return clean

    @field_validator("env_var_names", "environment_variables")
    @classmethod
    def validate_env_var_names(cls, v: Optional[List[str]]) -> List[str]:
        if v is None:
            return []
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

    @field_validator("setup_commands", "validation_commands")
    @classmethod
    def validate_commands_list(cls, v: List[str]) -> List[str]:
        cleaned: List[str] = []
        for cmd in v:
            clean = cmd.strip()
            if not clean:
                continue
            if len(clean) > 500:
                raise ValueError(f"Command exceeds maximum length of 500 characters: '{clean[:50]}...'")
            cleaned.append(clean)
        return cleaned

    @model_validator(mode="after")
    def validate_runtime_and_package_manager_compatibility(self) -> "SetupManifest":
        """Verify that runtime, version, language, package manager, and commands are compatible and safe."""
        node_pms = {PackageManager.NPM, PackageManager.PNPM, PackageManager.YARN, PackageManager.BUN}
        python_pms = {PackageManager.PIP, PackageManager.POETRY, PackageManager.UV}

        # Synchronize environment_variables into env_var_names if needed
        if self.environment_variables:
            for ev in self.environment_variables:
                if ev not in self.env_var_names:
                    self.env_var_names.append(ev)

        # Validate runtime version format and compatibility
        v = self.runtime_version.strip()
        if self.runtime == RuntimeType.PYTHON:
            m = re.match(r"^3\.(\d+)(\.\d+)?.*$", v)
            if not m:
                raise ValueError(
                    f"Invalid Python runtime version format '{v}'. Expected semver format such as '3.11.9' or '3.12'."
                )
            minor = int(m.group(1))
            if minor < 8 or minor > 14:
                raise ValueError(
                    f"Unsupported Python runtime version '{v}'. Supported Python versions are 3.8 through 3.14 (e.g., '3.11.9', '3.12')."
                )

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

            # Language inference and compatibility
            if self.language is None:
                self.language = "python"
            elif self.language in {"javascript", "typescript"}:
                raise ValueError(
                    f"Language '{self.language}' is incompatible with Python runtime. Expected 'python'."
                )

        elif self.runtime == RuntimeType.NODE:
            m = re.match(r"^(\d+)(\.\d+)?(\.\d+)?.*$", v)
            if not m:
                raise ValueError(
                    f"Invalid Node.js runtime version format '{v}'. Expected semver format such as '20.14.0' or '18'."
                )
            major = int(m.group(1))
            if major not in {16, 18, 20, 22}:
                raise ValueError(
                    f"Unsupported Node.js runtime version '{v}'. Supported Node versions are 16, 18, 20, 22 (e.g., '20.14.0', '18.20.0')."
                )

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

            # Language inference and compatibility
            if self.language is None:
                self.language = "typescript" if self.project_type == ProjectType.NEXTJS_APP else "javascript"
            elif self.language == "python":
                raise ValueError(
                    f"Language '{self.language}' is incompatible with Node.js runtime. Expected 'javascript' or 'typescript'."
                )

        # Synchronize test_command and validation_commands
        if self.test_command and not self.validation_commands:
            self.validation_commands = [self.test_command]
        elif self.validation_commands and not self.test_command:
            self.test_command = self.validation_commands[0]

        # Security inspection across all declared commands
        for cmd in self.setup_commands:
            validate_command_security_and_compatibility(cmd, self.runtime, "setup_commands")
        for cmd in self.validation_commands:
            validate_command_security_and_compatibility(cmd, self.runtime, "validation_commands")
        if self.start_command:
            validate_command_security_and_compatibility(self.start_command, self.runtime, "start_command")
        if self.test_command:
            validate_command_security_and_compatibility(self.test_command, self.runtime, "test_command")

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


class ManifestDiscoveryRequest(BaseModel):
    """Request payload to discover or infer a setup manifest from a repository."""
    repo_path: Optional[str] = Field(
        default=None,
        description="Local directory path of the repository.",
        examples=["/path/to/my-repo"],
    )
    repo_url: Optional[str] = Field(
        default=None,
        description="Optional Git repository URL.",
        examples=["https://github.com/org/repo"],
    )


class ManifestDiscoveryResult(BaseModel):
    """Result of searching a repository for a setup manifest or generating a fallback."""
    discovered: bool = Field(..., description="True if a valid manifest file or inferred project configuration was found.")
    source: str = Field(..., description="Identifier of the discovery source (e.g., 'explicit_file: sandbox.manifest.json', 'inferred: pyproject.toml', 'fallback: default').")
    manifest_file_path: Optional[str] = Field(default=None, description="Path to the discovered manifest file if one was found.")
    manifest: Optional[SetupManifest] = Field(default=None, description="The validated or inferred SetupManifest.")
    is_fallback: bool = Field(default=False, description="True if a fallback manifest was generated due to missing or unsupported repository files.")
    warnings: List[str] = Field(default_factory=list, description="Discovery warnings or notes.")
    errors: List[ValidationErrorDetail] = Field(default_factory=list, description="Validation errors if an explicit manifest was invalid.")


class WorkflowStep(BaseModel):
    """Individual phase in the setup pipeline."""
    name: str = Field(..., description="Step identifier.")
    description: str = Field(..., description="Human-readable step objective.")
    status: StepStatus = Field(default=StepStatus.PENDING, description="Current execution state.")
    started_at: Optional[datetime] = Field(default=None, description="Step commencement timestamp.")
    completed_at: Optional[datetime] = Field(default=None, description="Step completion timestamp.")
    duration_seconds: Optional[float] = Field(default=None, description="Elapsed time in seconds.")
    error_message: Optional[str] = Field(default=None, description="Diagnostic error details if step failed.")


class ApprovalDecisionRequest(BaseModel):
    """Request payload to approve or reject a pending workflow plan."""
    approved: bool = Field(..., description="True to approve execution, False to reject.")
    plan_fingerprint: Optional[str] = Field(
        default=None,
        description="Optional SHA256 digest of the plan displayed to the user to guard against race conditions.",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Optional user comments or rejection explanation.",
    )


class WorkflowPlanResponse(BaseModel):
    """Detailed plan submitted for user inspection and approval."""
    workflow_id: str = Field(..., description="Unique workflow identifier.")
    status: WorkflowStatus = Field(..., description="Overall workflow status.")
    approval_status: ApprovalStatus = Field(..., description="Approval status.")
    plan_fingerprint: str = Field(..., description="Deterministic SHA256 digest of the execution plan.")
    execution_plan: List[Dict[str, Any]] = Field(..., description="Ordered list of planned execution steps.")
    setup_commands: List[str] = Field(default_factory=list, description="Commands planned for environment setup.")
    validation_commands: List[str] = Field(default_factory=list, description="Commands planned for verification.")
    runtime: str = Field(..., description="Target runtime and version.")
    package_manager: str = Field(..., description="Package manager to be used.")
    dependencies_count: int = Field(..., description="Number of declared dependencies.")
    is_ready_for_approval: bool = Field(..., description="True if workflow is currently paused awaiting approval.")
    approved_at: Optional[datetime] = Field(default=None, description="Timestamp of approval if approved.")
    rejection_reason: Optional[str] = Field(default=None, description="Reason for rejection if rejected.")
    evaluation_result: Optional[EvaluationResult] = Field(default=None, description="Structured agent evaluation result.")


class WorkflowCreateResponse(BaseModel):
    """Response returned upon successful workflow initialization."""
    workflow_id: str = Field(..., description="Unique workflow identifier.")
    status: WorkflowStatus = Field(..., description="Initial workflow status.")
    is_simulated: bool = Field(default=True, description="Indicates that execution is simulated without physical provisioning.")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    steps: List[WorkflowStep] = Field(..., description="Initial workflow step progression.")
    message: str = Field(..., description="Status summary message.")
    approval_status: Optional[ApprovalStatus] = Field(default=None, description="Initial approval status.")
    plan_fingerprint: Optional[str] = Field(default=None, description="Execution plan fingerprint if plan was created.")
    execution_plan: Optional[List[Dict[str, Any]]] = Field(default=None, description="Planned execution steps.")
    current_stage: Optional[str] = Field(default=None, description="Current active stage in the 6-stage lifecycle.")
    current_message: Optional[str] = Field(default=None, description="Live headline message explaining what the agent is doing.")
    progress_percentage: Optional[int] = Field(default=0, description="Overall progress percentage 0-100.")
    completed_stages: Optional[List[str]] = Field(default_factory=list, description="IDs of completed stages.")
    stages: Optional[List[WorkflowStageInfo]] = Field(default_factory=list, description="Structured 6-stage timeline.")
    approval_required: Optional[bool] = Field(default=False, description="True if human approval is required.")
    evaluation_result: Optional[EvaluationResult] = Field(default=None, description="Structured agent evaluation result.")


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
    approval_status: Optional[ApprovalStatus] = Field(default=None, description="Approval status (awaiting_approval, approved, rejected).")
    plan_fingerprint: Optional[str] = Field(default=None, description="Deterministic hash of the execution plan.")
    execution_plan: Optional[List[Dict[str, Any]]] = Field(default=None, description="Planned execution steps.")
    approved_at: Optional[datetime] = Field(default=None, description="Approval timestamp in UTC.")
    rejection_reason: Optional[str] = Field(default=None, description="User rejection reason if rejected.")
    current_stage: Optional[str] = Field(default=None, description="Current active stage in the 6-stage lifecycle.")
    current_message: Optional[str] = Field(default=None, description="Live headline message explaining what the agent is doing.")
    progress_percentage: Optional[int] = Field(default=0, description="Overall progress percentage 0-100.")
    completed_stages: Optional[List[str]] = Field(default_factory=list, description="IDs of completed stages.")
    stages: Optional[List[WorkflowStageInfo]] = Field(default_factory=list, description="Structured 6-stage timeline.")
    approval_required: Optional[bool] = Field(default=False, description="True if human approval is required.")
    evaluation_result: Optional[EvaluationResult] = Field(default=None, description="Structured agent evaluation result.")
    execution_steps: Optional[List[Dict[str, Any]]] = Field(default=None, description="Detailed command outputs executed in sandbox.")
    verification_results: Optional[Dict[str, Any]] = Field(default=None, description="Readiness checks and probe results.")


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

"""Typed graph state definition for the Developer Sandbox Bootstrapper LangGraph agent."""

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class StepStatusRecord(TypedDict, total=False):
    """Execution status record for an individual pipeline step."""
    name: str
    description: str
    status: str  # "pending", "running", "completed", "failed", "skipped"
    started_at: Optional[str]
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    error_message: Optional[str]


class ExecutionPlanItem(TypedDict, total=False):
    """Specification of a planned execution step."""
    name: str
    description: str
    phase: str
    requires_runtime: bool
    commands: Optional[List[str]]


class SandboxAgentState(TypedDict, total=False):
    """Typed graph state for the Developer Sandbox LangGraph orchestration agent.

    Tracks the entire lifecycle from manifest discovery/validation to planned execution,
    isolated sandbox verification, and final workflow summarization.
    """
    workflow_id: str
    manifest: Dict[str, Any]
    validation_result: Dict[str, Any]
    discovery_metadata: Dict[str, Any]
    execution_plan: List[Dict[str, Any]]
    execution_logs: List[Dict[str, Any]]
    current_step: Optional[str]
    step_statuses: Dict[str, StepStatusRecord]
    errors: List[str]
    final_summary: Dict[str, Any]
    status: str  # "queued", "running", "awaiting_approval", "completed", "failed", "rejected"
    approval_status: str  # "pending", "awaiting_approval", "approved", "rejected"
    approved_at: Optional[str]
    rejection_reason: Optional[str]
    plan_fingerprint: str
    approved_plan_fingerprint: Optional[str]

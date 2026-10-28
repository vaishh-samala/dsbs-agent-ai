"""LangGraph StateGraph assembly for Developer Sandbox Bootstrapper orchestration."""

from typing import Any, Dict, Optional
import uuid

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from app.agent.nodes import (
    approval_gate,
    execute_step,
    finalize_workflow,
    plan_setup,
    should_execute_after_approval,
    should_execute_after_validation,
    should_verify_after_execution,
    validate_manifest,
    verify_setup,
)
from app.agent.state import SandboxAgentState

# Shared checkpointer for workflow state recovery across approval interrupts
shared_checkpointer = MemorySaver()


def build_sandbox_graph(checkpointer: Optional[Any] = None) -> StateGraph:
    """Construct the StateGraph with deterministic nodes, approval gate, and conditional branching."""
    workflow = StateGraph(SandboxAgentState)

    # 1. Register all 6 workflow nodes
    workflow.add_node("validate_manifest", validate_manifest)
    workflow.add_node("plan_setup", plan_setup)
    workflow.add_node("approval_gate", approval_gate)
    workflow.add_node("execute_step", execute_step)
    workflow.add_node("verify_setup", verify_setup)
    workflow.add_node("finalize_workflow", finalize_workflow)

    # 2. Control flow edges
    # START -> validate_manifest
    workflow.add_edge(START, "validate_manifest")

    # Conditional edge: invalid manifest stops execution and transitions directly to finalize_workflow
    workflow.add_conditional_edges(
        "validate_manifest",
        should_execute_after_validation,
        {
            "plan_setup": "plan_setup",
            "finalize_workflow": "finalize_workflow",
        },
    )

    # plan_setup -> approval_gate
    workflow.add_edge("plan_setup", "approval_gate")

    # Conditional edge: approval gate requires user decision before proceeding to execute_step
    workflow.add_conditional_edges(
        "approval_gate",
        should_execute_after_approval,
        {
            "execute_step": "execute_step",
            "finalize_workflow": "finalize_workflow",
        },
    )

    # Conditional edge: execution failure stops verification and transitions directly to finalize_workflow
    workflow.add_conditional_edges(
        "execute_step",
        should_verify_after_execution,
        {
            "verify_setup": "verify_setup",
            "finalize_workflow": "finalize_workflow",
        },
    )

    # verify_setup -> finalize_workflow
    workflow.add_edge("verify_setup", "finalize_workflow")

    # finalize_workflow -> END
    workflow.add_edge("finalize_workflow", END)

    return workflow


# Precompiled singleton agent instance with checkpointer
sandbox_agent = build_sandbox_graph().compile(checkpointer=shared_checkpointer)


def run_sandbox_agent(
    manifest: Dict[str, Any],
    workflow_id: Optional[str] = None,
) -> SandboxAgentState:
    """Execute the agent up to the approval gate (or terminal failure if invalid).

    Validates the manifest and formulates the execution plan, pausing at the approval gate.
    """
    w_id = workflow_id or f"wf-{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": w_id}}
    initial_state: SandboxAgentState = {
        "workflow_id": w_id,
        "manifest": manifest,
        "validation_result": {},
        "discovery_metadata": {},
        "execution_plan": [],
        "execution_logs": [],
        "current_step": None,
        "step_statuses": {},
        "errors": [],
        "final_summary": {},
        "status": "queued",
        "approval_status": "pending",
        "approved_at": None,
        "rejection_reason": None,
        "plan_fingerprint": "",
        "approved_plan_fingerprint": None,
    }

    invoke_res = sandbox_agent.invoke(initial_state, config=config)

    # Retrieve checkpointed state snapshot
    snapshot = sandbox_agent.get_state(config)
    if snapshot and snapshot.values:
        clean_state = dict(snapshot.values)
    else:
        clean_state = dict(invoke_res)

    # Clean internal interrupt markers if present
    clean_state.pop("__interrupt__", None)
    return clean_state


def resume_sandbox_agent(
    workflow_id: str,
    approved: bool,
    reason: Optional[str] = None,
    plan_fingerprint: Optional[str] = None,
) -> SandboxAgentState:
    """Resume execution of a paused sandbox agent workflow with the user's approval decision.

    Guarantees that commands are only executed if approved=True and plan fingerprint matches.
    """
    config = {"configurable": {"thread_id": workflow_id}}
    decision_payload = {
        "approved": approved,
        "reason": reason,
        "plan_fingerprint": plan_fingerprint,
    }

    sandbox_agent.invoke(Command(resume=decision_payload), config=config)

    snapshot = sandbox_agent.get_state(config)
    if snapshot and snapshot.values:
        clean_state = dict(snapshot.values)
    else:
        clean_state = {}

    clean_state.pop("__interrupt__", None)
    return clean_state


def get_sandbox_agent_state(workflow_id: str) -> Optional[SandboxAgentState]:
    """Retrieve raw checkpointed agent state for a given workflow ID."""
    config = {"configurable": {"thread_id": workflow_id}}
    snapshot = sandbox_agent.get_state(config)
    if snapshot and snapshot.values:
        clean = dict(snapshot.values)
        clean.pop("__interrupt__", None)
        return clean
    return None

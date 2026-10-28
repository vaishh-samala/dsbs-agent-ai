"""LangGraph StateGraph assembly for Developer Sandbox Bootstrapper orchestration."""

from typing import Any, Dict, Optional
import uuid

from langgraph.graph import END, START, StateGraph

from app.agent.nodes import (
    execute_step,
    finalize_workflow,
    plan_setup,
    should_execute_after_validation,
    should_verify_after_execution,
    validate_manifest,
    verify_setup,
)
from app.agent.state import SandboxAgentState


def build_sandbox_graph() -> StateGraph:
    """Construct the StateGraph with deterministic nodes and conditional branching."""
    workflow = StateGraph(SandboxAgentState)

    # 1. Register all 5 workflow nodes
    workflow.add_node("validate_manifest", validate_manifest)
    workflow.add_node("plan_setup", plan_setup)
    workflow.add_node("execute_step", execute_step)
    workflow.add_node("verify_setup", verify_setup)
    workflow.add_node("finalize_workflow", finalize_workflow)

    # 2. Define control flow edges
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

    # plan_setup -> execute_step
    workflow.add_edge("plan_setup", "execute_step")

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


# Precompiled singleton agent instance
sandbox_agent = build_sandbox_graph().compile()


def run_sandbox_agent(
    manifest: Dict[str, Any],
    workflow_id: Optional[str] = None,
) -> SandboxAgentState:
    """Execute the compiled LangGraph agent for a given manifest and return final state."""
    w_id = workflow_id or f"wf-{uuid.uuid4().hex[:12]}"
    initial_state: SandboxAgentState = {
        "workflow_id": w_id,
        "manifest": manifest,
        "validation_result": {},
        "execution_plan": [],
        "current_step": None,
        "step_statuses": {},
        "errors": [],
        "final_summary": {},
        "status": "queued",
    }

    final_state = sandbox_agent.invoke(initial_state)
    return final_state

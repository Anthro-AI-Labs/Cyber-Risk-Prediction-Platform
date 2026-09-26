from typing import List, Dict, Optional, Any
from app.models import (
    Tool,
    Scenario,
    MappingEvidence,
    MITRETechnique,
    RiskAssumptions,
    OptimizerPlan,
    OptimizerMove,
    LossRange,
)
from app.engine import evaluate_all_scenarios
from app.risk import calculate_scenario_probability, run_monte_carlo

BASELINE_TOOL_IDS = ["email_security", "edr", "firewall", "siem", "tool_x"]

def run_optimizer(
    budget: Optional[int],
    allow_remove_baseline: bool,
    all_tools: Dict[str, Tool],
    scenarios: Dict[str, Scenario],
    mappings: List[MappingEvidence],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
    assumptions: RiskAssumptions,
) -> OptimizerPlan:
    target_budget = budget if budget is not None else 345000

    pass_probs = {
        "stopped": assumptions.step_pass_probability.stopped,
        "detected": assumptions.step_pass_probability.detected,
        "missed": assumptions.step_pass_probability.missed,
        "starting_condition": assumptions.step_pass_probability.starting_condition,
    }

    # Baseline calculation
    baseline_evals = evaluate_all_scenarios(
        scenarios=scenarios,
        active_tool_ids=BASELINE_TOOL_IDS,
        mappings=mappings,
        scenario_overrides=scenario_overrides,
        techniques=techniques,
    )
    baseline_ale = 0.0
    for sc_id, b_eval in baseline_evals.items():
        bp = calculate_scenario_probability(b_eval.steps, pass_probs)
        sc_assump = assumptions.scenarios[sc_id]
        baseline_ale += sc_assump.attempts_per_year.likely * bp * sc_assump.loss_per_success.likely
    baseline_spend = sum(all_tools[tid].annual_cost for tid in BASELINE_TOOL_IDS)

    # Determine locked vs free tools
    locked_tool_ids: List[str] = []
    free_tool_ids: List[str] = []

    for tid, tool in all_tools.items():
        if tool.baseline_required and not allow_remove_baseline:
            locked_tool_ids.append(tid)
        else:
            free_tool_ids.append(tid)

    # Exhaustive search
    best_config: Optional[List[str]] = None
    best_ale: float = float("inf")
    best_spend: int = float("inf")
    best_probs: Dict[str, float] = {}

    num_free = len(free_tool_ids)
    for mask in range(1 << num_free):
        cfg = list(locked_tool_ids)
        for i in range(num_free):
            if (mask >> i) & 1:
                cfg.append(free_tool_ids[i])

        spend = sum(all_tools[t].annual_cost for t in cfg)
        if spend > target_budget:
            continue

        evals = evaluate_all_scenarios(
            scenarios=scenarios,
            active_tool_ids=cfg,
            mappings=mappings,
            scenario_overrides=scenario_overrides,
            techniques=techniques,
        )

        curr_ale = 0.0
        curr_probs: Dict[str, float] = {}
        for sc_id, sc_eval in evals.items():
            p = calculate_scenario_probability(sc_eval.steps, pass_probs)
            curr_probs[sc_id] = p
            sc_assump = assumptions.scenarios[sc_id]
            curr_ale += sc_assump.attempts_per_year.likely * p * sc_assump.loss_per_success.likely

        # Tie breaker: lower spend
        if curr_ale < best_ale - 0.5:
            best_ale = curr_ale
            best_spend = spend
            best_config = cfg
            best_probs = curr_probs
        elif abs(curr_ale - best_ale) <= 0.5:
            if spend < best_spend:
                best_ale = curr_ale
                best_spend = spend
                best_config = cfg
                best_probs = curr_probs

    if best_config is None:
        # Fallback to locked tools if within budget, else empty
        best_config = locked_tool_ids
        best_spend = sum(all_tools[t].annual_cost for t in best_config)
        best_ale = baseline_ale
        best_probs = {sc_id: 1.0 for sc_id in scenarios}

    # Moves calculation
    moves: List[OptimizerMove] = []
    # Removed tools
    for tid in BASELINE_TOOL_IDS:
        if tid not in best_config:
            t = all_tools[tid]
            moves.append(
                OptimizerMove(
                    action="remove",
                    action_label="Remove",
                    tool_id=tid,
                    tool_name=t.name,
                    cost=t.annual_cost,
                    cost_display=f"${t.annual_cost:,}/yr" if t.annual_cost else "$0",
                )
            )

    # Added / Enabled tools
    for tid in best_config:
        if tid not in BASELINE_TOOL_IDS:
            t = all_tools[tid]
            action = "enable" if t.status == "owned_not_enabled" else "add"
            label = "Switch on" if action == "enable" else "Add"
            moves.append(
                OptimizerMove(
                    action=action,
                    action_label=label,
                    tool_id=tid,
                    tool_name=t.name,
                    cost=t.annual_cost,
                    cost_display=f"${t.annual_cost:,}/yr" if t.annual_cost else "$0",
                )
            )

    # Risk reduction calculation
    reduction_pct = (1.0 - (best_ale / baseline_ale)) * 100.0 if baseline_ale > 0 else 0.0

    # Range for best config
    _, ale_range_after = run_monte_carlo(best_probs, assumptions)

    removes_baseline = any(
        all_tools[m.tool_id].baseline_required for m in moves if m.action == "remove"
    )
    baseline_warning = (
        "Removes a required baseline control — check compliance and incident-response needs first."
        if removes_baseline else None
    )

    return OptimizerPlan(
        recommended_tools=best_config,
        moves=moves,
        spend_before=baseline_spend,
        spend_after=best_spend,
        ale_before=round(baseline_ale),
        ale_after=round(best_ale),
        ale_range_after=ale_range_after,
        risk_reduction_pct=round(reduction_pct, 1),
        risk_reduction_sentence=f"In this sample model, this plan reduces estimated loss exposure by {reduction_pct:.1f}%.",
        removes_baseline_control=removes_baseline,
        baseline_warning=baseline_warning,
    )

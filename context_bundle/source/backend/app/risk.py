import random
from typing import Dict, List, Set, Optional, Tuple, Any
from app.models import (
    ScenarioEvaluation,
    RiskAssumptions,
    LossRange,
    ScenarioRiskResult,
    SeveritySummary,
    SeverityCount,
    SeverityALE,
    Tool,
    ToolReturnResult,
    SimulationResponse,
    MappingEvidence,
    Scenario,
    MITRETechnique,
)
from app.engine import evaluate_all_scenarios

def calculate_scenario_probability(
    eval_steps: List[Any],
    pass_probs: Dict[str, float],
) -> float:
    p = 1.0
    for step in eval_steps:
        outcome = step.outcome if hasattr(step, "outcome") else step["outcome"]
        prob = pass_probs.get(outcome, 1.0)
        p *= prob
    return p

def determine_severity(
    p: float,
    thresholds: Any,
) -> str:
    crit = thresholds.critical if hasattr(thresholds, "critical") else thresholds["critical"]
    high = thresholds.high if hasattr(thresholds, "high") else thresholds["high"]
    med = thresholds.medium if hasattr(thresholds, "medium") else thresholds["medium"]

    if p >= crit:
        return "critical"
    elif p >= high:
        return "high"
    elif p >= med:
        return "medium"
    return "low"

def format_risk_score(p: float) -> Tuple[float, str]:
    pct = p * 100.0
    if pct < 0.1:
        return pct, "< 0.1%"
    return pct, f"{pct:.1f}%"

def pert_sample(a: float, m: float, c: float, rnd: random.Random) -> float:
    if c <= a:
        return a
    alpha = 1.0 + 4.0 * (m - a) / (c - a)
    beta = 1.0 + 4.0 * (c - m) / (c - a)
    return a + rnd.betavariate(alpha, beta) * (c - a)

def run_monte_carlo(
    scen_probs: Dict[str, float],
    assumptions: RiskAssumptions,
) -> Tuple[Dict[str, LossRange], LossRange]:
    iterations = assumptions.monte_carlo.iterations
    if iterations <= 0:
        zero_range = LossRange(p10=0.0, p50=0.0, p90=0.0)
        return {sc_id: zero_range for sc_id in scen_probs}, zero_range

    seed = assumptions.monte_carlo.seed
    rnd = random.Random(seed)

    scen_losses: Dict[str, List[float]] = {sc_id: [] for sc_id in scen_probs}
    total_losses: List[float] = []

    for _ in range(iterations):
        tot = 0.0
        for sc_id, p in scen_probs.items():
            sc_assump = assumptions.scenarios[sc_id]
            f_param = sc_assump.attempts_per_year
            l_param = sc_assump.loss_per_success

            att = pert_sample(f_param.min, f_param.likely, f_param.max, rnd)
            loss_per = pert_sample(l_param.min, l_param.likely, l_param.max, rnd)
            loss = att * p * loss_per

            scen_losses[sc_id].append(loss)
            tot += loss
        total_losses.append(tot)

    p10_idx = int(iterations * 0.10)
    p50_idx = int(iterations * 0.50)
    p90_idx = int(iterations * 0.90)

    scenario_ranges: Dict[str, LossRange] = {}
    for sc_id, vals in scen_losses.items():
        vals.sort()
        scenario_ranges[sc_id] = LossRange(
            p10=vals[p10_idx],
            p50=vals[p50_idx],
            p90=vals[p90_idx],
        )

    total_losses.sort()
    total_range = LossRange(
        p10=total_losses[p10_idx],
        p50=total_losses[p50_idx],
        p90=total_losses[p90_idx],
    )

    return scenario_ranges, total_range

def compute_simulation(
    active_tool_ids: List[str],
    all_tools: Dict[str, Tool],
    scenarios: Dict[str, Scenario],
    mappings: List[MappingEvidence],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
    assumptions: RiskAssumptions,
    tool_noise_fn: Any,
) -> SimulationResponse:
    # 1. Outcomes
    scenario_evals = evaluate_all_scenarios(
        scenarios=scenarios,
        active_tool_ids=active_tool_ids,
        mappings=mappings,
        scenario_overrides=scenario_overrides,
        techniques=techniques,
    )

    pass_probs = {
        "stopped": assumptions.step_pass_probability.stopped,
        "detected": assumptions.step_pass_probability.detected,
        "missed": assumptions.step_pass_probability.missed,
        "starting_condition": assumptions.step_pass_probability.starting_condition,
    }

    # 2. Probabilities, ALE, Severities
    scen_probs: Dict[str, float] = {}
    scen_results: Dict[str, ScenarioRiskResult] = {}
    total_ale_point = 0.0

    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    sev_ale = {"critical": 0.0, "high": 0.0, "medium": 0.0, "low": 0.0}

    for sc_id, eval_res in scenario_evals.items():
        p = calculate_scenario_probability(eval_res.steps, pass_probs)
        scen_probs[sc_id] = p

        sc_assump = assumptions.scenarios[sc_id]
        ale_point = sc_assump.attempts_per_year.likely * p * sc_assump.loss_per_success.likely
        total_ale_point += ale_point

        sev = determine_severity(p, assumptions.severity_thresholds)
        sev_counts[sev] += 1
        sev_ale[sev] += ale_point

        pct, pct_display = format_risk_score(p)

        # Temporary placeholder for range (computed next)
        scen_results[sc_id] = ScenarioRiskResult(
            id=sc_id,
            probability=p,
            risk_score_pct=pct,
            risk_score_display=pct_display,
            severity=sev,
            ale_point=ale_point,
            ale_point_rounded=round(ale_point),
            ale_range=LossRange(p10=0.0, p50=0.0, p90=0.0),
            stopping_points=eval_res.stopping_points,
            status=eval_res.status,
            steps=eval_res.steps,
        )

    # 3. Monte Carlo ranges
    scenario_ranges, total_ale_range = run_monte_carlo(scen_probs, assumptions)
    for sc_id in scen_results:
        scen_results[sc_id].ale_range = scenario_ranges[sc_id]

    # 4. Total Spend and Total Noise
    total_spend = sum(all_tools[t_id].annual_cost for t_id in active_tool_ids if t_id in all_tools)
    total_noise = sum(tool_noise_fn(t_id) or 0 for t_id in active_tool_ids)

    # 5. Per-Tool Counterfactual ROSI and Metrics
    active_set = set(active_tool_ids)
    tool_returns: List[ToolReturnResult] = []
    low_return_count = 0

    for t_id, tool in all_tools.items():
        is_active = t_id in active_set
        # Variant tools for counterfactual
        if is_active:
            variant_tool_ids = [tid for tid in active_tool_ids if tid != t_id]
        else:
            variant_tool_ids = active_tool_ids + [t_id]

        variant_evals = evaluate_all_scenarios(
            scenarios=scenarios,
            active_tool_ids=variant_tool_ids,
            mappings=mappings,
            scenario_overrides=scenario_overrides,
            techniques=techniques,
        )

        variant_total_ale = 0.0
        for sc_id, v_eval in variant_evals.items():
            vp = calculate_scenario_probability(v_eval.steps, pass_probs)
            sc_assump = assumptions.scenarios[sc_id]
            variant_total_ale += sc_assump.attempts_per_year.likely * vp * sc_assump.loss_per_success.likely

        if is_active:
            ale_without = variant_total_ale
            # Unrounded reduction
            risk_reduction = ale_without - total_ale_point
        else:
            ale_without = total_ale_point
            risk_reduction = total_ale_point - variant_total_ale

        # Prevent negative tiny float noise around 0
        if abs(risk_reduction) < 1e-6:
            risk_reduction = 0.0

        risk_reduction_rounded = round(risk_reduction)

        if tool.annual_cost > 0:
            rosi = (risk_reduction - tool.annual_cost) / tool.annual_cost
            rosi_pct = rosi * 100.0
            rosi_display = f"{'+' if rosi >= 0 else ''}{round(rosi_pct)}%"
            if rosi >= 1.0:
                classification = "high_return"
            elif rosi >= 0:
                classification = "positive_return"
            else:
                classification = "low_return"
                low_return_count += 1
        else:
            rosi = None
            rosi_pct = None
            if risk_reduction_rounded > 0:
                rosi_display = f"Risk reduced by ${risk_reduction_rounded:,} at $0 extra cost"
                classification = "high_return"
            else:
                rosi_display = "Free"
                classification = "positive_return"

        if classification == "low_return":
            if tool.baseline_required:
                classification_label = "Low return in tested scenarios"
            else:
                classification_label = "Low return in tested scenarios — worth a closer look"
        elif classification == "high_return":
            classification_label = "High return"
        else:
            classification_label = "Positive return"

        baseline_note = (
            "Required baseline control — value extends beyond tested scenarios"
            if tool.baseline_required else None
        )

        # Count metrics for the tool
        # stopping_points: stopped steps where tool is in stopping_tools (under current config if active, or when active)
        stopping_points = 0
        unique_stops = 0
        unique_detections = 0

        if is_active:
            for sc_id, curr_eval in scenario_evals.items():
                v_eval = variant_evals[sc_id]
                for i, curr_step in enumerate(curr_eval.steps):
                    v_step = v_eval.steps[i]
                    if curr_step.outcome == "stopped" and t_id in curr_step.stopping_tools:
                        stopping_points += 1
                    if curr_step.outcome == "stopped" and v_step.outcome != "stopped":
                        unique_stops += 1
                    if curr_step.outcome == "detected" and v_step.outcome == "missed":
                        unique_detections += 1
        else:
            for sc_id, v_eval in variant_evals.items():
                curr_eval = scenario_evals[sc_id]
                for i, v_step in enumerate(v_eval.steps):
                    curr_step = curr_eval.steps[i]
                    if v_step.outcome == "stopped" and t_id in v_step.stopping_tools:
                        stopping_points += 1
                    if v_step.outcome == "stopped" and curr_step.outcome != "stopped":
                        unique_stops += 1
                    if v_step.outcome == "detected" and curr_step.outcome == "missed":
                        unique_detections += 1

        overlap_stops = max(0, stopping_points - unique_stops)
        tool_noise = tool_noise_fn(t_id)

        tool_returns.append(
            ToolReturnResult(
                id=tool.id,
                name=tool.name,
                category=tool.category,
                annual_cost=tool.annual_cost,
                status=tool.status,
                baseline_required=tool.baseline_required,
                is_active=is_active,
                ale_without=ale_without,
                risk_reduction=risk_reduction,
                risk_reduction_rounded=risk_reduction_rounded,
                rosi_pct=rosi_pct,
                rosi_display=rosi_display,
                classification=classification,
                classification_label=classification_label,
                baseline_note=baseline_note,
                stopping_points=stopping_points,
                unique_stops=unique_stops,
                unique_detections=unique_detections,
                overlap_stops=overlap_stops,
                noise_alerts=tool_noise,
            )
        )

    # Sort tool returns: active first, then rosi descending
    tool_returns.sort(
        key=lambda tr: (
            0 if tr.is_active else 1,
            -(tr.rosi_pct if tr.rosi_pct is not None else 999999.0)
        )
    )

    sev_summary = SeveritySummary(
        counts=SeverityCount(**sev_counts),
        ale_by_severity=SeverityALE(**sev_ale),
    )

    return SimulationResponse(
        active_tool_ids=active_tool_ids,
        total_spend=total_spend,
        total_ale_point=total_ale_point,
        total_ale_point_rounded=round(total_ale_point),
        total_ale_range=total_ale_range,
        total_noise=total_noise,
        scenarios=scen_results,
        severity_summary=sev_summary,
        tool_returns=tool_returns,
        tools_with_low_return_count=low_return_count,
    )

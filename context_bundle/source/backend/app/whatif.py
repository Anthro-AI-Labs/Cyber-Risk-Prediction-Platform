from typing import List, Dict, Optional, Any
from app.models import (
    WhatIfRequest,
    WhatIfResponse,
    WhatIfDiff,
    ScenarioDiff,
    SimulationResponse,
    Tool,
    Scenario,
    MappingEvidence,
    MITRETechnique,
    RiskAssumptions,
)
from app.risk import compute_simulation

SEV_DISPLAY = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}

def resolve_variant_tools(
    baseline_tool_ids: List[str],
    variant_tool_ids: Optional[List[str]],
    change: Optional[Dict[str, Any]],
) -> List[str]:
    if variant_tool_ids is not None:
        return list(variant_tool_ids)

    if not change:
        return list(baseline_tool_ids)

    tools = set(baseline_tool_ids)
    c_type = change.get("type")
    tool_id = change.get("tool_id")
    old_tool = change.get("old_tool_id")
    new_tool = change.get("new_tool_id")

    if c_type in ("remove", "delete"):
        if tool_id in tools:
            tools.remove(tool_id)
    elif c_type in ("add", "enable"):
        if tool_id:
            tools.add(tool_id)
    elif c_type == "replace":
        if old_tool in tools:
            tools.remove(old_tool)
        if new_tool:
            tools.add(new_tool)
    elif c_type == "set":
        tools = set(change.get("tool_ids", []))

    return list(tools)

def compute_whatif(
    request: WhatIfRequest,
    all_tools: Dict[str, Tool],
    scenarios: Dict[str, Scenario],
    mappings: List[MappingEvidence],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
    assumptions: RiskAssumptions,
    tool_noise_fn: Any,
) -> WhatIfResponse:
    baseline_ids = request.baseline_tool_ids
    variant_ids = resolve_variant_tools(
        baseline_tool_ids=baseline_ids,
        variant_tool_ids=request.variant_tool_ids,
        change=request.change,
    )

    baseline_sim = compute_simulation(
        active_tool_ids=baseline_ids,
        all_tools=all_tools,
        scenarios=scenarios,
        mappings=mappings,
        scenario_overrides=scenario_overrides,
        techniques=techniques,
        assumptions=assumptions,
        tool_noise_fn=tool_noise_fn,
    )

    variant_sim = compute_simulation(
        active_tool_ids=variant_ids,
        all_tools=all_tools,
        scenarios=scenarios,
        mappings=mappings,
        scenario_overrides=scenario_overrides,
        techniques=techniques,
        assumptions=assumptions,
        tool_noise_fn=tool_noise_fn,
    )

    # Compute diff
    base_set = set(baseline_ids)
    var_set = set(variant_ids)

    added = [t for t in variant_ids if t not in base_set]
    removed = [t for t in baseline_ids if t not in var_set]

    spend_delta = variant_sim.total_spend - baseline_sim.total_spend
    noise_delta = variant_sim.total_noise - baseline_sim.total_noise
    ale_delta_point = variant_sim.total_ale_point - baseline_sim.total_ale_point
    ale_delta_point_rounded = round(ale_delta_point)
    ale_delta_pct = (
        (ale_delta_point / baseline_sim.total_ale_point * 100.0)
        if baseline_sim.total_ale_point > 0 else 0.0
    )

    scenario_diffs: Dict[str, ScenarioDiff] = {}
    change_sentences: List[str] = []

    # Sentences for tool removals/additions
    for r_id in removed:
        t_name = all_tools[r_id].name if r_id in all_tools else r_id
        change_sentences.append(f"− Removed {t_name}")

    for a_id in added:
        t = all_tools.get(a_id)
        t_name = t.name if t else a_id
        verb = "Switched on" if (t and t.status == "owned_not_enabled") else "Added"
        change_sentences.append(f"+ {verb} {t_name}")

    any_scen_changed = False
    for sc_id, b_sc in baseline_sim.scenarios.items():
        v_sc = variant_sim.scenarios[sc_id]
        changed = (
            abs(b_sc.ale_point - v_sc.ale_point) > 0.5
            or b_sc.stopping_points != v_sc.stopping_points
            or b_sc.severity != v_sc.severity
        )
        if changed:
            any_scen_changed = True
            sc_name = scenarios[sc_id].name if sc_id in scenarios else sc_id
            b_sev = SEV_DISPLAY.get(b_sc.severity, b_sc.severity)
            v_sev = SEV_DISPLAY.get(v_sc.severity, v_sc.severity)
            sev_part = f"{b_sev} → {v_sev}, " if b_sev != v_sev else ""

            stop_part = (
                f", blocked steps {b_sc.stopping_points} → {v_sc.stopping_points}"
                if b_sc.stopping_points != v_sc.stopping_points else ""
            )

            change_sentences.append(
                f"{sc_name}: {sev_part}chance {b_sc.risk_score_display} → {v_sc.risk_score_display}, "
                f"estimated loss ${b_sc.ale_point_rounded:,} → ${v_sc.ale_point_rounded:,}{stop_part} (estimate)."
            )

        scenario_diffs[sc_id] = ScenarioDiff(
            id=sc_id,
            name=scenarios[sc_id].name if sc_id in scenarios else sc_id,
            baseline_severity=b_sc.severity,
            variant_severity=v_sc.severity,
            baseline_risk_score_display=b_sc.risk_score_display,
            variant_risk_score_display=v_sc.risk_score_display,
            baseline_ale=b_sc.ale_point_rounded,
            variant_ale=v_sc.ale_point_rounded,
            baseline_stopping_points=b_sc.stopping_points,
            variant_stopping_points=v_sc.stopping_points,
            changed=changed,
        )

    # If removal occurred but no scenario changed at all
    if removed and not any_scen_changed:
        change_sentences.append(
            "No change in any tested attack. The same steps are still blocked by other tools."
        )

    diff = WhatIfDiff(
        added_tools=added,
        removed_tools=removed,
        spend_delta=spend_delta,
        noise_delta=noise_delta,
        ale_delta_point=ale_delta_point,
        ale_delta_point_rounded=ale_delta_point_rounded,
        ale_delta_pct=round(ale_delta_pct, 1),
        scenario_diffs=scenario_diffs,
        change_sentences=change_sentences,
    )

    return WhatIfResponse(
        baseline=baseline_sim,
        variant=variant_sim,
        diff=diff,
    )

from typing import List, Dict, Set, Optional, Any
from app.models import (
    Scenario,
    ScenarioStep,
    ScenarioEvaluation,
    StepOutcome,
    StepEvidenceDetail,
    MappingEvidence,
    MITRETechnique,
)
from app.data_loader import EVIDENCE_LABELS

def evaluate_step(
    step: ScenarioStep,
    active_tools_set: Set[str],
    mappings_by_technique: Dict[str, List[MappingEvidence]],
    scenario_override_step: Optional[Dict[str, Any]],
    techniques: Dict[str, MITRETechnique],
) -> StepOutcome:
    # Check for starting condition override (e.g. S3 step 1)
    if scenario_override_step and scenario_override_step.get("assumed_compromise"):
        return StepOutcome(
            order=step.order,
            technique_id=step.technique_id,
            technique_name=step.technique_name,
            step=step.step,
            outcome="starting_condition",
            stopping_tools=[],
            detecting_tools=[],
            open_routes=[],
            evidence=[],
        )

    # All step techniques: main + alternatives
    tech_ids = [step.technique_id] + [alt.id for alt in step.alternative_techniques]

    step_stopping_tools: Set[str] = set()
    step_detecting_tools: Set[str] = set()
    open_routes: List[str] = []
    evidence_list: List[StepEvidenceDetail] = []

    tech_is_stopped: Dict[str, bool] = {}
    tech_is_detected: Dict[str, bool] = {}

    for tid in tech_ids:
        t_mappings = [
            m for m in mappings_by_technique.get(tid, [])
            if m.tool_id in active_tools_set
        ]

        stopped = False
        detected = False

        for m in t_mappings:
            step_detecting_tools.add(m.tool_id)
            if m.effect == "stop":
                stopped = True
                detected = True
                step_stopping_tools.add(m.tool_id)
            elif m.effect == "detect":
                detected = True

            ev_label = EVIDENCE_LABELS.get(m.evidence_type, m.evidence_type)
            mit_name = m.attached_mitigation.name if m.attached_mitigation else None
            mit_url = m.attached_mitigation.url if m.attached_mitigation else None

            evidence_list.append(
                StepEvidenceDetail(
                    technique_id=tid,
                    tool_id=m.tool_id,
                    effect=m.effect,
                    evidence_type=m.evidence_type,
                    evidence_label=ev_label,
                    mitigation_name=mit_name,
                    mitigation_url=mit_url,
                    ctid_support=m.ctid_support,
                )
            )

        tech_is_stopped[tid] = stopped
        tech_is_detected[tid] = detected
        if not stopped:
            open_routes.append(tid)

    # Determine step outcome
    all_stopped = all(tech_is_stopped.get(tid, False) for tid in tech_ids)
    all_detected = all(tech_is_detected.get(tid, False) for tid in tech_ids)

    if all_stopped:
        outcome = "stopped"
    elif all_detected:
        outcome = "detected"
    else:
        outcome = "missed"

    return StepOutcome(
        order=step.order,
        technique_id=step.technique_id,
        technique_name=step.technique_name,
        step=step.step,
        outcome=outcome,
        stopping_tools=sorted(list(step_stopping_tools)) if outcome == "stopped" else [],
        detecting_tools=sorted(list(step_detecting_tools)),
        open_routes=open_routes,
        evidence=evidence_list,
    )

def evaluate_scenario(
    scenario: Scenario,
    active_tools_set: Set[str],
    mappings_by_technique: Dict[str, List[MappingEvidence]],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
) -> ScenarioEvaluation:
    scen_overrides = scenario_overrides.get(scenario.id, {}).get("steps", {})

    evaluated_steps: List[StepOutcome] = []
    for step in scenario.steps:
        step_override = scen_overrides.get(str(step.order))
        out = evaluate_step(
            step=step,
            active_tools_set=active_tools_set,
            mappings_by_technique=mappings_by_technique,
            scenario_override_step=step_override,
            techniques=techniques,
        )
        evaluated_steps.append(out)

    evaluated_real_steps = [s for s in evaluated_steps if s.outcome != "starting_condition"]
    stopping_points = sum(1 for s in evaluated_real_steps if s.outcome == "stopped")

    if any(s.outcome == "stopped" for s in evaluated_real_steps):
        status = "stopped"
    elif any(s.outcome == "detected" for s in evaluated_real_steps):
        status = "detected"
    else:
        status = "missed"

    return ScenarioEvaluation(
        id=scenario.id,
        name=scenario.name,
        category=scenario.category,
        status=status,
        steps=evaluated_steps,
        stopping_points=stopping_points,
        evaluated_steps_count=len(evaluated_real_steps),
    )

def evaluate_all_scenarios(
    scenarios: Dict[str, Scenario],
    active_tool_ids: List[str],
    mappings: List[MappingEvidence],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
) -> Dict[str, ScenarioEvaluation]:
    active_tools_set = set(active_tool_ids)
    mappings_by_technique: Dict[str, List[MappingEvidence]] = {}
    for m in mappings:
        mappings_by_technique.setdefault(m.technique_id, []).append(m)

    results: Dict[str, ScenarioEvaluation] = {}
    for sc_id, sc in scenarios.items():
        results[sc_id] = evaluate_scenario(
            scenario=sc,
            active_tools_set=active_tools_set,
            mappings_by_technique=mappings_by_technique,
            scenario_overrides=scenario_overrides,
            techniques=techniques,
        )
    return results

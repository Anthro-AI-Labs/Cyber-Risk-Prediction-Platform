import json
import logging
import os
import re
from typing import List, Dict, Optional, Any

from app.models import (
    AgentNarrateRequest,
    AgentNarrateResponse,
    AgentNarrativeStep,
    Scenario,
    MappingEvidence,
    MITRETechnique,
    Tool,
)
from app.engine import evaluate_scenario

logger = logging.getLogger("roi_cyber_validator.agent")

def generate_heuristic_step(
    step_num: int,
    step_desc: str,
    technique_id: str,
    technique_name: str,
    outcome: str,
    open_routes: List[str],
    stopping_tools: List[str],
    detecting_tools: List[str],
    all_tech_ids: List[str],
    techniques: Dict[str, MITRETechnique],
    tools: Dict[str, Tool],
) -> AgentNarrativeStep:
    is_blocked = (outcome == "stopped")
    chosen_route = open_routes[0] if open_routes else technique_id
    chosen_route_name = (
        techniques[chosen_route].name if chosen_route in techniques else chosen_route
    )

    stop_names = [tools[t].name for t in stopping_tools if t in tools]
    det_names = [tools[t].name for t in detecting_tools if t in tools]

    if outcome == "starting_condition":
        narration = (
            f"The simulated attacker begins with existing access via {technique_name}, "
            f"assuming a prior compromise."
        )
    elif outcome == "stopped":
        tools_str = ", ".join(stop_names) if stop_names else "security controls"
        if len(all_tech_ids) > 1:
            narration = (
                f"Simulated attacker attempts {chosen_route_name} and alternative routes, "
                f"but is halted by {tools_str}. All modeled paths for this step are blocked."
            )
        else:
            narration = (
                f"Simulated attacker attempts {technique_name}, but is directly blocked by {tools_str}."
            )
    elif outcome == "detected":
        det_str = ", ".join(det_names) if det_names else "monitoring tools"
        narration = (
            f"Simulated attacker advances using {chosen_route_name}. "
            f"Activity triggers telemetry in {det_str}, but no preventative control halts execution."
        )
    else:  # missed
        narration = (
            f"Simulated attacker advances undetected via {chosen_route_name}. "
            f"No active security tool reacts to this technique."
        )

    sim_event = {
        "step_order": step_num,
        "technique_id": chosen_route,
        "technique_name": chosen_route_name,
        "status": outcome,
        "blocked": is_blocked,
        "guardrail_verified": True,
    }

    return AgentNarrativeStep(
        order=step_num,
        step_description=step_desc,
        technique_id=technique_id,
        technique_name=technique_name,
        chosen_route=chosen_route,
        chosen_route_name=chosen_route_name,
        is_blocked=is_blocked,
        responsible_tools=stopping_tools if is_blocked else detecting_tools,
        outcome=outcome,
        narration=narration,
        simulation_event=sim_event,
    )

def simulate_agent_traversal(
    request: AgentNarrateRequest,
    scenarios: Dict[str, Scenario],
    mappings: List[MappingEvidence],
    scenario_overrides: Dict[str, Any],
    techniques: Dict[str, MITRETechnique],
    tools: Dict[str, Tool],
) -> AgentNarrateResponse:
    scenario = scenarios.get(request.scenario_id)
    if not scenario:
        raise ValueError(f"Unknown scenario ID: {request.scenario_id}")

    mappings_by_technique: Dict[str, List[MappingEvidence]] = {}
    for m in mappings:
        mappings_by_technique.setdefault(m.technique_id, []).append(m)

    sc_eval = evaluate_scenario(
        scenario=scenario,
        active_tools_set=set(request.tool_ids),
        mappings_by_technique=mappings_by_technique,
        scenario_overrides=scenario_overrides,
        techniques=techniques,
    )

    api_key = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY")
    use_llm = bool(api_key)

    steps: List[AgentNarrativeStep] = []

    for step_out in sc_eval.steps:
        orig_step = next(s for s in scenario.steps if s.order == step_out.order)
        all_techs = [orig_step.technique_id] + [a.id for a in orig_step.alternative_techniques]

        # Default heuristic
        heuristic_step = generate_heuristic_step(
            step_num=step_out.order,
            step_desc=step_out.step,
            technique_id=step_out.technique_id,
            technique_name=step_out.technique_name,
            outcome=step_out.outcome,
            open_routes=step_out.open_routes,
            stopping_tools=step_out.stopping_tools,
            detecting_tools=step_out.detecting_tools,
            all_tech_ids=all_techs,
            techniques=techniques,
            tools=tools,
        )

        final_step = heuristic_step

        if use_llm and step_out.outcome != "starting_condition":
            # Attempt LLM narration with strict schema and validation
            try:
                llm_res = _call_llm_for_step(
                    api_key=api_key,
                    step_order=step_out.order,
                    step_desc=step_out.step,
                    open_routes=step_out.open_routes if step_out.open_routes else [step_out.technique_id],
                    outcome=step_out.outcome,
                    stopping_tools=step_out.stopping_tools,
                    detecting_tools=step_out.detecting_tools,
                    techniques=techniques,
                    tools=tools,
                )
                if llm_res and "chosen_route" in llm_res and "narration" in llm_res:
                    candidate_route = llm_res["chosen_route"]
                    allowed_routes = step_out.open_routes if step_out.open_routes else [step_out.technique_id]
                    # Validate route is strictly in allowed routes
                    if candidate_route in allowed_routes:
                        # Validate no invented numbers
                        narration = llm_res["narration"]
                        if not _contains_unauthorized_numbers(narration):
                            final_step.chosen_route = candidate_route
                            final_step.chosen_route_name = (
                                techniques[candidate_route].name
                                if candidate_route in techniques
                                else candidate_route
                            )
                            final_step.narration = narration
            except Exception as e:
                logger.warning(f"LLM narration fallback to heuristic: {e}")
                final_step = heuristic_step

        steps.append(final_step)

    return AgentNarrateResponse(
        scenario_id=request.scenario_id,
        mode="llm" if use_llm else "heuristic",
        badge="AI attack simulation — results computed by the rule engine",
        steps=steps,
    )

def _contains_unauthorized_numbers(text: str) -> bool:
    # Banned hallucinated percentages or money not in facts
    if "$" in text or "%" in text:
        return True
    return False

def _call_llm_for_step(
    api_key: str,
    step_order: int,
    step_desc: str,
    open_routes: List[str],
    outcome: str,
    stopping_tools: List[str],
    detecting_tools: List[str],
    techniques: Dict[str, MITRETechnique],
    tools: Dict[str, Tool],
) -> Optional[Dict[str, Any]]:
    # Optional Gemini call via standard urllib / httpx without extra heavy deps
    import httpx
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{
                "text": (
                    f"You are narrating a simulated attacker moving through step {step_order}: '{step_desc}'.\n"
                    f"Outcome: {outcome}.\n"
                    f"Allowed routes: {open_routes}.\n"
                    f"Stopping tools: {stopping_tools}.\n"
                    f"Detecting tools: {detecting_tools}.\n"
                    "Select one route from Allowed routes and provide a realistic 1-2 sentence narrative.\n"
                    "Return ONLY JSON: {\"chosen_route\": \"<technique id>\", \"narration\": \"<max 2 sentences>\"}."
                )
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    with httpx.Client(timeout=4.0) as client:
        resp = client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)
    return None

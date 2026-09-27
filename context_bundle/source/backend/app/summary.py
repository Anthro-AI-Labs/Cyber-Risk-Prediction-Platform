import json
import logging
import os
import re
from typing import List, Dict, Optional, Any

from app.models import SummaryRequest, SummaryResponse, SimulationResponse
from app.risk import compute_simulation

logger = logging.getLogger("roi_cyber_validator.summary")

BANNED_PHRASES = [
    "secure",
    "fully protected",
    "useless",
    "wasted budget",
    "wastes money",
    "guaranteed",
    "prevents all",
    "will lose",
    "exact loss",
    "25% of budgets are wasted",
    "cuts risk by 80%",
]

def check_banned_phrases(text: str) -> Optional[str]:
    text_lower = text.lower()
    for phrase in BANNED_PHRASES:
        if phrase in text_lower:
            return phrase
    return None

def generate_template_summary(sim: SimulationResponse) -> SummaryResponse:
    total_loss_fmt = f"${sim.total_ale_point_rounded:,}"
    spend_fmt = f"${sim.total_spend:,}"
    p10_fmt = f"${round(sim.total_ale_range.p10):,}"
    p90_fmt = f"${round(sim.total_ale_range.p90):,}"

    crit_count = sim.severity_summary.counts.critical
    high_count = sim.severity_summary.counts.high
    med_count = sim.severity_summary.counts.medium
    low_count = sim.severity_summary.counts.low

    low_return_tools = [t for t in sim.tool_returns if t.classification == "low_return" and t.is_active]
    high_return_tools = [t for t in sim.tool_returns if t.classification == "high_return" and t.is_active]

    executive_summary = (
        f"In tested scenarios, the current configuration incurs an annual security spend of {spend_fmt} "
        f"and carries an estimated annual financial loss exposure of {total_loss_fmt} (estimate), with a "
        f"likely range between {p10_fmt} and {p90_fmt} (P10–P90). Evaluated across four common attack scenarios, "
        f"{crit_count} scenario is rated Critical, {high_count} High, {med_count} Medium, and {low_count} Low."
    )

    key_findings = [
        f"Total estimated annual loss exposure is {total_loss_fmt} (range: {p10_fmt}–{p90_fmt}) across 4 tested scenarios.",
        f"Active tools produce an estimated {sim.total_noise} false alarms on a normal workday.",
    ]

    if high_return_tools:
        top_tool = high_return_tools[0]
        key_findings.append(
            f"{top_tool.name} demonstrates high return in tested scenarios, removing an estimated ${top_tool.risk_reduction_rounded:,} in loss exposure."
        )

    if low_return_tools:
        for lt in low_return_tools:
            if lt.baseline_required:
                key_findings.append(
                    f"{lt.name} shows low return in tested scenarios, but is a required baseline control whose value extends beyond tested scenarios."
                )
            else:
                key_findings.append(
                    f"{lt.name} shows low return in tested scenarios — worth a closer look."
                )

    recommended_actions = [
        "Review tool allocations using the Budget Optimizer to maximize risk reduction within existing budget limits.",
        "Ensure owned identity protections (such as MFA) are enabled to cut high-exposure credential attacks at $0 additional software cost.",
        "Examine controls with low return in tested scenarios to evaluate overlap or redundancy.",
    ]

    return SummaryResponse(
        source="template",
        executive_summary=executive_summary,
        key_findings=key_findings,
        recommended_actions=recommended_actions,
    )

def generate_executive_summary(
    request: SummaryRequest,
    sim: SimulationResponse,
) -> SummaryResponse:
    template_res = generate_template_summary(sim)

    api_key = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return template_res

    # Try optional LLM rephrase with guardrails
    try:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        facts_prompt = (
            f"Here are the facts from the security risk evaluation engine:\n"
            f"- Spend: ${sim.total_spend:,}\n"
            f"- Estimated annual loss exposure: ${sim.total_ale_point_rounded:,}\n"
            f"- Range: ${round(sim.total_ale_range.p10):,} to ${round(sim.total_ale_range.p90):,}\n"
            f"- Severity counts: {sim.severity_summary.counts.model_dump()}\n"
            f"- Normal day false alarms: {sim.total_noise}\n"
            f"Rephrase this into a concise executive summary for a board of directors.\n"
            f"Rules:\n"
            f"1. Never claim the organization is 'secure', 'fully protected', or 'guaranteed'.\n"
            f"2. Never use the words 'useless', 'wasted budget', 'exact loss', or 'will lose'.\n"
            f"3. Use only the exact numbers provided above; do NOT invent any numbers.\n"
            f"4. Label all loss figures as estimates.\n"
            f"Return JSON: {{\"executive_summary\": \"...\", \"key_findings\": [\"...\"], \"recommended_actions\": [\"...\"]}}"
        )

        payload = {
            "contents": [{"parts": [{"text": facts_prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }

        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)

                combined_text = (
                    parsed.get("executive_summary", "")
                    + " " + " ".join(parsed.get("key_findings", []))
                    + " " + " ".join(parsed.get("recommended_actions", []))
                )

                # Check banned phrases
                violation = check_banned_phrases(combined_text)
                if violation:
                    logger.warning(f"Rejecting LLM summary due to banned phrase: '{violation}'")
                    return template_res

                # Check for ungrounded numbers (e.g. 80%, 25%)
                if "80%" in combined_text or "25%" in combined_text:
                    logger.warning("Rejecting LLM summary due to ungrounded marketing claim numbers")
                    return template_res

                return SummaryResponse(
                    source="llm",
                    executive_summary=parsed.get("executive_summary", template_res.executive_summary),
                    key_findings=parsed.get("key_findings", template_res.key_findings),
                    recommended_actions=parsed.get("recommended_actions", template_res.recommended_actions),
                )
    except Exception as e:
        logger.warning(f"Summary LLM fallback: {e}")

    return template_res

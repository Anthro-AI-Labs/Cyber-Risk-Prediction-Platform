import json
from pathlib import Path
from app.data_loader import data_loader
from app.risk import compute_simulation

def test_engine_matches_committed_fixture_snapshot():
    data_loader.reset_assumptions()
    fixture_configs = {
        "baseline": ["email_security", "edr", "firewall", "siem", "tool_x"],
        "remove_tool_x": ["email_security", "edr", "firewall", "siem"],
        "remove_edr": ["email_security", "firewall", "siem", "tool_x"],
        "enable_mfa_owned": ["email_security", "edr", "firewall", "siem", "tool_x", "mfa_owned"],
        "add_identity_suite": ["email_security", "edr", "firewall", "siem", "tool_x", "identity_suite"],
        "add_payment_process": ["email_security", "edr", "firewall", "siem", "tool_x", "payment_process"],
    }

    results = {}
    for name, tool_ids in fixture_configs.items():
        sim = compute_simulation(
            active_tool_ids=tool_ids,
            all_tools=data_loader.tools,
            scenarios=data_loader.scenarios,
            mappings=data_loader.mappings,
            scenario_overrides=data_loader.scenario_overrides,
            techniques=data_loader.techniques,
            assumptions=data_loader.current_assumptions,
            tool_noise_fn=data_loader.get_tool_noise,
        )

        scen_summary = {}
        for sc_id, sc in sim.scenarios.items():
            scen_summary[sc_id] = {
                "probability": sc.probability,
                "risk_score_display": sc.risk_score_display,
                "severity": sc.severity,
                "ale_point_rounded": sc.ale_point_rounded,
                "stopping_points": sc.stopping_points,
                "status": sc.status,
                "step_outcomes": [st.outcome for st in sc.steps],
            }

        results[name] = {
            "active_tool_ids": tool_ids,
            "total_spend": sim.total_spend,
            "total_ale_point_rounded": sim.total_ale_point_rounded,
            "total_noise": sim.total_noise,
            "scenarios": scen_summary,
        }

    # Verify key assertions
    assert results["baseline"]["total_ale_point_rounded"] == 707619
    assert results["enable_mfa_owned"]["total_ale_point_rounded"] == 555315
    assert results["add_identity_suite"]["total_ale_point_rounded"] == 400264
    assert results["add_payment_process"]["total_ale_point_rounded"] == 457842

    # Read-only: the committed snapshot must equal what the engine produces now.
    fixture_path = Path(__file__).parent / "fixtures" / "engine_test_cases.json"
    committed = json.loads(fixture_path.read_text(encoding="utf-8"))
    assert results == committed

from app.data_loader import data_loader
from app.engine import evaluate_all_scenarios

def test_engine_baseline_step_outcomes():
    baseline_tools = ["email_security", "edr", "firewall", "siem", "tool_x"]
    evals = evaluate_all_scenarios(
        scenarios=data_loader.scenarios,
        active_tool_ids=baseline_tools,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
    )

    # S1
    s1 = evals["S1"]
    assert [s.outcome for s in s1.steps] == ["stopped", "missed", "missed", "missed", "missed"]
    assert s1.status == "stopped"
    assert s1.stopping_points == 1

    # S2
    s2 = evals["S2"]
    assert [s.outcome for s in s2.steps] == ["detected", "missed", "detected", "missed"]
    assert s2.status == "detected"
    assert s2.stopping_points == 0

    # S3
    s3 = evals["S3"]
    assert [s.outcome for s in s3.steps] == ["starting_condition", "missed", "missed", "missed"]
    assert s3.status == "missed"
    assert s3.stopping_points == 0

    # S4
    s4 = evals["S4"]
    assert [s.outcome for s in s4.steps] == [
        "stopped", "detected", "stopped", "stopped", "detected", "detected", "stopped", "stopped"
    ]
    # S4 step 5 is detected: T1021.001 stopped by firewall, T1570 detected by EDR
    assert s4.steps[4].outcome == "detected"
    assert s4.status == "stopped"
    assert s4.stopping_points == 5

def test_scenario_status_counts():
    baseline_tools = ["email_security", "edr", "firewall", "siem", "tool_x"]
    evals = evaluate_all_scenarios(
        scenarios=data_loader.scenarios,
        active_tool_ids=baseline_tools,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
    )
    statuses = [s.status for s in evals.values()]
    assert statuses.count("stopped") == 2  # S1, S4
    assert statuses.count("detected") == 1  # S2
    assert statuses.count("missed") == 1  # S3

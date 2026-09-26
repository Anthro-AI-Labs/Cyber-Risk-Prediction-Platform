import pytest
from app.data_loader import data_loader
from app.risk import compute_simulation
from app.whatif import compute_whatif, WhatIfRequest

BASELINE_TOOLS = ["email_security", "edr", "firewall", "siem", "tool_x"]

@pytest.fixture
def baseline_sim():
    data_loader.reset_assumptions()
    return compute_simulation(
        active_tool_ids=BASELINE_TOOLS,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )

def test_baseline_spend(baseline_sim):
    assert baseline_sim.total_spend == 345000

def test_baseline_scenarios(baseline_sim):
    sc = baseline_sim.scenarios

    # S1: stopped, missed, missed, missed, missed | 16.3% | medium | $234,578
    s1 = sc["S1"]
    assert [st.outcome for st in s1.steps] == ["stopped", "missed", "missed", "missed", "missed"]
    assert s1.risk_score_display == "16.3%"
    assert s1.severity == "medium"
    assert s1.ale_point_rounded == 234578

    # S2: detected, missed, detected, missed | 32.5% | high | $155,952
    s2 = sc["S2"]
    assert [st.outcome for st in s2.steps] == ["detected", "missed", "detected", "missed"]
    assert s2.risk_score_display == "32.5%"
    assert s2.severity == "high"
    assert s2.ale_point_rounded == 155952

    # S3: starting_condition, missed, missed, missed | 85.7% | critical | $308,655
    s3 = sc["S3"]
    assert [st.outcome for st in s3.steps] == ["starting_condition", "missed", "missed", "missed"]
    assert s3.risk_score_display == "85.7%"
    assert s3.severity == "critical"
    assert s3.ale_point_rounded == 308655

    # S4: stopped, detected, stopped, stopped, detected, detected, stopped, stopped | < 0.1% | low | $622
    s4 = sc["S4"]
    assert [st.outcome for st in s4.steps] == [
        "stopped", "detected", "stopped", "stopped", "detected", "detected", "stopped", "stopped"
    ]
    assert s4.risk_score_display == "< 0.1%"
    assert round(s4.probability, 8) == 0.00006912
    assert s4.severity == "low"
    assert s4.ale_point_rounded == 622

    # Total ALE: $699,807
    assert baseline_sim.total_ale_point_rounded == 699807

def test_baseline_monte_carlo(baseline_sim):
    # Monte Carlo (seed 42): assert P10 < 699,807 < P90 for the total
    rng = baseline_sim.total_ale_range
    assert rng.p10 < 699807 < rng.p90

def test_per_tool_returns(baseline_sim):
    tools_by_id = {t.id: t for t in baseline_sim.tool_returns}

    # email_security: ALE without $1,581,806 | Risk reduction $882,000 | ROSI 2105% | high_return
    email = tools_by_id["email_security"]
    assert round(email.ale_without) == 1581806
    assert email.risk_reduction_rounded == 882000
    assert round(email.rosi_pct) == 2105
    assert email.classification == "high_return"
    assert email.baseline_note is not None

    # edr: ALE without $866,321 | Risk reduction $166,515 | ROSI 85% | positive_return
    edr = tools_by_id["edr"]
    assert round(edr.ale_without) == 866321
    assert edr.risk_reduction_rounded == 166515
    assert round(edr.rosi_pct) == 85
    assert edr.classification == "positive_return"

    # firewall: ALE without $706,593 | Risk reduction $6,786 | ROSI −90% | low_return
    fw = tools_by_id["firewall"]
    assert round(fw.ale_without) == 706593
    assert fw.risk_reduction_rounded == 6786
    assert round(fw.rosi_pct) == -90
    assert fw.classification == "low_return"
    assert fw.baseline_note is not None

    # siem: ALE without $934,818 | Risk reduction $235,011 | ROSI 176% | high_return
    siem = tools_by_id["siem"]
    assert round(siem.ale_without) == 934818
    assert siem.risk_reduction_rounded == 235011
    assert round(siem.rosi_pct) == 176
    assert siem.classification == "high_return"
    assert siem.baseline_note is not None

    # tool_x: ALE without $699,807 | Risk reduction $0 | ROSI −100% | low_return
    tx = tools_by_id["tool_x"]
    assert round(tx.ale_without) == 699807
    assert tx.risk_reduction_rounded == 0
    assert round(tx.rosi_pct) == -100
    assert tx.classification == "low_return"

    # tools_with_low_return = 2 (firewall, tool_x)
    assert baseline_sim.tools_with_low_return_count == 2

    # Count metrics
    assert tx.unique_stops == 0
    assert tx.stopping_points == 1
    assert edr.unique_stops == 3
    assert baseline_sim.scenarios["S4"].stopping_points == 5

    # Noise: email 4, edr 6, firewall 9, siem 18, tool_x 31; total 68
    assert email.noise_alerts == 4
    assert edr.noise_alerts == 6
    assert fw.noise_alerts == 9
    assert siem.noise_alerts == 18
    assert tx.noise_alerts == 31
    assert baseline_sim.total_noise == 68

def test_whatif_remove_edr():
    req = WhatIfRequest(
        baseline_tool_ids=BASELINE_TOOLS,
        change={"type": "remove", "tool_id": "edr"},
    )
    res = compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    # S4 ALE $622 → $167,137, stopping_points 5 → 2, spend −$90,000
    assert res.variant.scenarios["S4"].ale_point_rounded == 167137
    assert res.variant.scenarios["S4"].stopping_points == 2
    assert res.diff.spend_delta == -90000

def test_whatif_remove_tool_x():
    req = WhatIfRequest(
        baseline_tool_ids=BASELINE_TOOLS,
        change={"type": "remove", "tool_id": "tool_x"},
    )
    res = compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    # no outcome or ALE change, spend −$60,000, noise −31
    assert res.diff.ale_delta_point_rounded == 0
    assert res.diff.spend_delta == -60000
    assert res.diff.noise_delta == -31
    assert any("No change in any tested attack" in s for s in res.diff.change_sentences)

def test_whatif_enable_mfa_owned():
    req = WhatIfRequest(
        baseline_tool_ids=BASELINE_TOOLS,
        change={"type": "enable", "tool_id": "mfa_owned"},
    )
    res = compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    # S2 risk score 32.5% → 2.3%, severity high → low, ALE $155,952 → $10,944
    s2 = res.variant.scenarios["S2"]
    assert s2.risk_score_display == "2.3%"
    assert s2.severity == "low"
    assert s2.ale_point_rounded == 10944
    # Total ALE $554,799. Risk reduction $145,008, spend delta $0
    assert res.variant.total_ale_point_rounded == 554799
    assert -res.diff.ale_delta_point_rounded == 145008
    assert res.diff.spend_delta == 0

def test_whatif_add_identity_suite():
    req = WhatIfRequest(
        baseline_tool_ids=BASELINE_TOOLS,
        change={"type": "add", "tool_id": "identity_suite"},
    )
    res = compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    # total ALE $392,451, risk reduction $307,355, ROSI 515%
    assert res.variant.total_ale_point_rounded == 392451
    assert -res.diff.ale_delta_point_rounded == 307355
    tool_ret = next(t for t in res.baseline.tool_returns if t.id == "identity_suite")
    assert round(tool_ret.rosi_pct) == 515

def test_whatif_add_payment_process():
    req = WhatIfRequest(
        baseline_tool_ids=BASELINE_TOOLS,
        change={"type": "add", "tool_id": "payment_process"},
    )
    res = compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    # S3 risk score 85.7% → 18.1%; total ALE $456,132, risk reduction $243,675, ROSI 2946%
    assert res.variant.scenarios["S3"].risk_score_display == "18.1%"
    assert res.variant.total_ale_point_rounded == 456132
    assert -res.diff.ale_delta_point_rounded == 243675
    tool_ret = next(t for t in res.baseline.tool_returns if t.id == "payment_process")
    assert round(tool_ret.rosi_pct) == 2946

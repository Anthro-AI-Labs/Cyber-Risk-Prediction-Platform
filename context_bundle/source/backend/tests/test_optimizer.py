from app.data_loader import data_loader
from app.optimizer import run_optimizer

def test_optimizer_locked_baseline():
    data_loader.reset_assumptions()
    plan = run_optimizer(
        budget=345000,
        allow_remove_baseline=False,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
    )

    # Final config: email_security, edr, firewall, siem, mfa_owned, identity_suite, payment_process
    expected_tools = {
        "email_security",
        "edr",
        "firewall",
        "siem",
        "mfa_owned",
        "identity_suite",
        "payment_process",
    }
    assert set(plan.recommended_tools) == expected_tools

    # Moves: remove tool_x, enable mfa_owned, add identity_suite, add payment_process
    removed = [m.tool_id for m in plan.moves if m.action == "remove"]
    enabled = [m.tool_id for m in plan.moves if m.action == "enable"]
    added = [m.tool_id for m in plan.moves if m.action == "add"]

    assert removed == ["tool_x"]
    assert enabled == ["mfa_owned"]
    assert set(added) == {"identity_suite", "payment_process"}

    # Spend $343,000, total ALE $81,357, reduction 88.5%
    assert plan.spend_after == 343000
    assert plan.ale_after == 81357
    assert plan.risk_reduction_pct == 88.5
    assert not plan.removes_baseline_control
    assert plan.baseline_warning is None

def test_optimizer_allow_remove_baseline():
    data_loader.reset_assumptions()
    plan = run_optimizer(
        budget=345000,
        allow_remove_baseline=True,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
    )

    # Additionally removes SIEM
    expected_tools = {
        "email_security",
        "edr",
        "firewall",
        "mfa_owned",
        "identity_suite",
        "payment_process",
    }
    assert set(plan.recommended_tools) == expected_tools

    # Spend $258,000, same ALE $81,357
    assert plan.spend_after == 258000
    assert plan.ale_after == 81357
    assert plan.removes_baseline_control
    assert plan.baseline_warning == (
        "Removes a required baseline control — check compliance and incident-response needs first."
    )

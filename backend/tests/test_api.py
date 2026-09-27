import json
from fastapi.testclient import TestClient
from app.main import app
from app.summary import BANNED_PHRASES

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_meta():
    res = client.get("/api/meta")
    assert res.status_code == 200
    data = res.json()
    assert "MITRE ATT&CK" in data["attribution_footer"]
    assert "methodology" in data

def test_evidence_report():
    res = client.get("/api/meta/evidence-report")
    assert res.status_code == 200
    data = res.json()
    assert "validated_mappings_count" in data
    assert data["validated_mappings_count"] > 0

def test_tools():
    res = client.get("/api/tools")
    assert res.status_code == 200
    tools = res.json()
    assert len(tools) == 8
    tool_ids = [t["id"] for t in tools]
    assert "email_security" in tool_ids
    assert "tool_x" in tool_ids

def test_scenarios():
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) == 4

    res_s1 = client.get("/api/scenarios/S1")
    assert res_s1.status_code == 200
    s1 = res_s1.json()
    assert s1["id"] == "S1"
    assert len(s1["steps"]) == 5

def test_techniques():
    res = client.get("/api/techniques/T1566.002")
    assert res.status_code == 200
    tech = res.json()
    assert tech["name"] == "Spearphishing Link"

def test_assumptions_crud():
    # Read
    res = client.get("/api/assumptions")
    assert res.status_code == 200
    orig = res.json()

    # Update
    updated = json.loads(json.dumps(orig))
    updated["severity_thresholds"]["critical"] = 0.55
    res_put = client.put("/api/assumptions", json=updated)
    assert res_put.status_code == 200
    assert res_put.json()["severity_thresholds"]["critical"] == 0.55

    # Reset
    res_reset = client.post("/api/assumptions/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["severity_thresholds"]["critical"] == 0.50

def test_simulate_api():
    payload = {"tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"]}
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_spend"] == 345000
    assert data["total_ale_point_rounded"] == 707619
    assert data["scenarios"]["S1"]["ale_point_rounded"] == 234578
    assert data["scenarios"]["S2"]["ale_point_rounded"] == 155952
    assert data["scenarios"]["S3"]["ale_point_rounded"] == 316384
    assert data["scenarios"]["S4"]["ale_point_rounded"] == 705

def test_whatif_api():
    payload = {
        "baseline_tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"],
        "change": {"type": "enable", "tool_id": "mfa_owned"},
    }
    res = client.post("/api/whatif", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["variant"]["total_ale_point_rounded"] == 555315
    assert data["diff"]["spend_delta"] == 0

def test_optimize_api():
    payload = {"budget": 345000, "allow_remove_baseline": False}
    res = client.post("/api/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["spend_after"] == 343000
    assert data["ale_after"] == 81357
    assert data["risk_reduction_pct"] == 88.5

def test_agent_narrate_api():
    payload = {
        "scenario_id": "S1",
        "tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"],
    }
    res = client.post("/api/agent/narrate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_id"] == "S1"
    assert len(data["steps"]) == 5
    assert "AI attack simulation" in data["badge"]
    assert data["steps"][0]["is_blocked"] is True

def test_normal_day_api():
    res = client.get("/api/normal-day?tool_ids=email_security,edr,firewall,siem,tool_x")
    assert res.status_code == 200
    data = res.json()
    assert data["total_active_noise"] == 68

def test_summary_api():
    payload = {"tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"]}
    res = client.post("/api/summary", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["source"] in ("template", "llm")
    assert len(data["executive_summary"]) > 0

def test_banned_phrases_scan_in_api_responses():
    """Scan all standard responses for banned copy rules from Section 9."""
    endpoints_to_check = [
        client.get("/api/meta").text,
        client.get("/api/tools").text,
        client.get("/api/scenarios").text,
        client.post("/api/simulate", json={"tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"]}).text,
        client.post("/api/optimize", json={"budget": 345000, "allow_remove_baseline": False}).text,
        client.post("/api/summary", json={"tool_ids": ["email_security", "edr", "firewall", "siem", "tool_x"]}).text,
    ]

    for body in endpoints_to_check:
        body_lower = body.lower()
        for banned in BANNED_PHRASES:
            # We allow "secure" only if part of standard words like "email_security" or "security"
            # but strictly forbid "is secure", "are secure", "company is secure"
            if banned == "secure":
                # Check for "is secure" or "are secure" or standalone "secure"
                import re
                matches = re.findall(r"\bsecure\b", body_lower)
                assert len(matches) == 0, f"Found banned word 'secure' in response: {body[:300]}"
            else:
                assert banned not in body_lower, f"Found banned phrase '{banned}' in response: {body[:300]}"

def test_validation_report_served_from_last_run():
    res = client.get("/api/meta/validation")
    assert res.status_code == 200
    data = res.json()
    assert {"scorecard", "all_passed", "d1_source_fidelity"} <= set(data)
    assert all(row["status"] in {"PASS", "FAIL", "NOT_RUN"} for row in data["scorecard"])

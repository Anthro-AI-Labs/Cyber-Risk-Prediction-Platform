import { describe, it, expect } from "vitest";
import {
  computeRisk,
  computeOptimizer,
  computeWhatIf,
  BASELINE_TOOLS,
  DEFAULT_ASSUMPTIONS,
} from "./engine";

describe("TypeScript Engine — Exact Section 8 Assertions", () => {
  it("evaluates Baseline scenario outcomes and financial loss", () => {
    const sim = computeRisk(BASELINE_TOOLS, DEFAULT_ASSUMPTIONS);

    expect(sim.total_spend).toBe(345000);
    expect(sim.total_ale_point_rounded).toBe(699807);

    // S1
    const s1 = sim.scenarios["S1"];
    expect(s1.steps.map((s) => s.outcome)).toEqual([
      "stopped",
      "missed",
      "missed",
      "missed",
      "missed",
    ]);
    expect(s1.risk_score_display).toBe("16.3%");
    expect(s1.severity).toBe("medium");
    expect(s1.ale_point_rounded).toBe(234578);

    // S2
    const s2 = sim.scenarios["S2"];
    expect(s2.steps.map((s) => s.outcome)).toEqual([
      "detected",
      "missed",
      "detected",
      "missed",
    ]);
    expect(s2.risk_score_display).toBe("32.5%");
    expect(s2.severity).toBe("high");
    expect(s2.ale_point_rounded).toBe(155952);

    // S3
    const s3 = sim.scenarios["S3"];
    expect(s3.steps.map((s) => s.outcome)).toEqual([
      "starting_condition",
      "missed",
      "missed",
      "missed",
    ]);
    expect(s3.risk_score_display).toBe("85.7%");
    expect(s3.severity).toBe("critical");
    expect(s3.ale_point_rounded).toBe(308655);

    // S4
    const s4 = sim.scenarios["S4"];
    expect(s4.steps.map((s) => s.outcome)).toEqual([
      "stopped",
      "detected",
      "stopped",
      "stopped",
      "detected",
      "detected",
      "stopped",
      "stopped",
    ]);
    expect(s4.risk_score_display).toBe("< 0.1%");
    expect(s4.severity).toBe("low");
    expect(s4.ale_point_rounded).toBe(622);

    // Monte Carlo P10 < 699,807 < P90
    expect(sim.total_ale_range.p10).toBeLessThan(699807);
    expect(sim.total_ale_range.p90).toBeGreaterThan(699807);
  });

  it("calculates per-tool counterfactual ROSI and metrics matching Section 8", () => {
    const sim = computeRisk(BASELINE_TOOLS, DEFAULT_ASSUMPTIONS);
    const byId = Object.fromEntries(sim.tool_returns.map((t) => [t.id, t]));

    // email_security
    expect(Math.round(byId["email_security"].ale_without)).toBe(1581806);
    expect(byId["email_security"].risk_reduction_rounded).toBe(882000);
    expect(Math.round(byId["email_security"].rosi_pct!)).toBe(2105);
    expect(byId["email_security"].classification).toBe("high_return");

    // edr
    expect(Math.round(byId["edr"].ale_without)).toBe(866321);
    expect(byId["edr"].risk_reduction_rounded).toBe(166515);
    expect(Math.round(byId["edr"].rosi_pct!)).toBe(85);
    expect(byId["edr"].classification).toBe("positive_return");

    // firewall
    expect(Math.round(byId["firewall"].ale_without)).toBe(706593);
    expect(byId["firewall"].risk_reduction_rounded).toBe(6786);
    expect(Math.round(byId["firewall"].rosi_pct!)).toBe(-90);
    expect(byId["firewall"].classification).toBe("low_return");

    // siem
    expect(Math.round(byId["siem"].ale_without)).toBe(934818);
    expect(byId["siem"].risk_reduction_rounded).toBe(235011);
    expect(Math.round(byId["siem"].rosi_pct!)).toBe(176);
    expect(byId["siem"].classification).toBe("high_return");

    // tool_x
    expect(Math.round(byId["tool_x"].ale_without)).toBe(699807);
    expect(byId["tool_x"].risk_reduction_rounded).toBe(0);
    expect(Math.round(byId["tool_x"].rosi_pct!)).toBe(-100);
    expect(byId["tool_x"].classification).toBe("low_return");

    expect(sim.tools_with_low_return_count).toBe(2);
    expect(sim.total_noise).toBe(68);
  });

  it("calculates What-If presets accurately", () => {
    // Enable MFA
    const mfaWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "mfa_owned"],
      DEFAULT_ASSUMPTIONS
    );
    expect(mfaWhatIf.variant.total_ale_point_rounded).toBe(554799);
    expect(mfaWhatIf.variant.scenarios["S2"].risk_score_display).toBe("2.3%");
    expect(mfaWhatIf.variant.scenarios["S2"].ale_point_rounded).toBe(10944);
    expect(-mfaWhatIf.diff.ale_delta_point_rounded).toBe(145008);

    // Add identity suite
    const idsWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "identity_suite"],
      DEFAULT_ASSUMPTIONS
    );
    expect(idsWhatIf.variant.total_ale_point_rounded).toBe(392451);
    expect(-idsWhatIf.diff.ale_delta_point_rounded).toBe(307355);

    // Add payment process
    const payWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "payment_process"],
      DEFAULT_ASSUMPTIONS
    );
    expect(payWhatIf.variant.total_ale_point_rounded).toBe(456132);
    expect(-payWhatIf.diff.ale_delta_point_rounded).toBe(243675);
  });

  it("finds the optimal budget plan matching Section 8", () => {
    const plan = computeOptimizer(345000, false, DEFAULT_ASSUMPTIONS);
    expect(new Set(plan.recommended_tools)).toEqual(
      new Set([
        "email_security",
        "edr",
        "firewall",
        "siem",
        "mfa_owned",
        "identity_suite",
        "payment_process",
      ])
    );
    expect(plan.spend_after).toBe(343000);
    expect(plan.ale_after).toBe(79647);
    expect(plan.risk_reduction_pct).toBe(88.6);
  });
});

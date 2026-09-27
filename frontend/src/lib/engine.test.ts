import { describe, it, expect } from "vitest";
import {
  computeRisk,
  computeOptimizer,
  computeWhatIf,
  BASELINE_TOOLS,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_MC_ITERATIONS,
  TOOLS,
  REQUIRED_SPEND,
} from "./engine";

describe("TypeScript Engine — Exact Section 8 Assertions (v3.2)", () => {
  it("evaluates Baseline scenario outcomes and financial loss", () => {
    const sim = computeRisk(BASELINE_TOOLS, DEFAULT_ASSUMPTIONS);

    expect(sim.total_spend).toBe(345000);
    expect(sim.total_ale_point_rounded).toBe(707619);

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
    expect(s3.ale_point_rounded).toBe(316384);

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
    expect(s4.ale_point_rounded).toBe(705);

    // Monte Carlo P10 < 707,619 < P90
    expect(sim.total_ale_range.p10).toBeLessThan(707619);
    expect(sim.total_ale_range.p90).toBeGreaterThan(707619);
  });

  it("calculates per-tool counterfactual ROSI and metrics matching Part C", () => {
    const sim = computeRisk(BASELINE_TOOLS, DEFAULT_ASSUMPTIONS);
    const byId = Object.fromEntries(sim.tool_returns.map((t) => [t.id, t]));

    // email_security
    expect(Math.round(byId["email_security"].ale_without)).toBe(1589930);
    expect(byId["email_security"].risk_reduction_rounded).toBe(882311);
    expect(Math.round(byId["email_security"].rosi_pct!)).toBe(2106);
    expect(byId["email_security"].classification).toBe("high_return");

    // edr
    expect(Math.round(byId["edr"].ale_without)).toBe(896358);
    expect(byId["edr"].risk_reduction_rounded).toBe(188739);
    expect(Math.round(byId["edr"].rosi_pct!)).toBe(110);
    expect(byId["edr"].classification).toBe("high_return");

    // firewall
    expect(Math.round(byId["firewall"].ale_without)).toBe(715310);
    expect(byId["firewall"].risk_reduction_rounded).toBe(7691);
    expect(Math.round(byId["firewall"].rosi_pct!)).toBe(-89);
    expect(byId["firewall"].classification).toBe("low_return");

    // siem
    expect(Math.round(byId["siem"].ale_without)).toBe(942630);
    expect(byId["siem"].risk_reduction_rounded).toBe(235011);
    expect(Math.round(byId["siem"].rosi_pct!)).toBe(176);
    expect(byId["siem"].classification).toBe("high_return");

    // tool_x
    expect(Math.round(byId["tool_x"].ale_without)).toBe(707619);
    expect(byId["tool_x"].risk_reduction_rounded).toBe(0);
    expect(Math.round(byId["tool_x"].rosi_pct!)).toBe(-100);
    expect(byId["tool_x"].classification).toBe("low_return");

    expect(sim.tools_with_low_return_count).toBe(2);
    expect(sim.total_noise).toBe(68);
  });

  it("calculates What-If presets accurately", () => {
    // Remove EDR
    const rmEdrWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      BASELINE_TOOLS.filter((t) => t !== "edr"),
      DEFAULT_ASSUMPTIONS
    );
    expect(rmEdrWhatIf.variant.scenarios["S4"].ale_point_rounded).toBe(189444);

    // Remove Tool X (no change)
    const rmToolXWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      BASELINE_TOOLS.filter((t) => t !== "tool_x"),
      DEFAULT_ASSUMPTIONS
    );
    expect(rmToolXWhatIf.variant.total_ale_point_rounded).toBe(707619);

    // Enable MFA
    const mfaWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "mfa_owned"],
      DEFAULT_ASSUMPTIONS
    );
    expect(mfaWhatIf.variant.total_ale_point_rounded).toBe(555315);
    expect(mfaWhatIf.variant.scenarios["S2"].risk_score_display).toBe("0.8%");
    expect(mfaWhatIf.variant.scenarios["S2"].severity).toBe("low");
    expect(mfaWhatIf.variant.scenarios["S2"].ale_point_rounded).toBe(3648);
    expect(-mfaWhatIf.diff.ale_delta_point_rounded).toBe(152304);

    // Add identity suite
    const idsWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "identity_suite"],
      DEFAULT_ASSUMPTIONS
    );
    expect(idsWhatIf.variant.total_ale_point_rounded).toBe(400264);
    expect(-idsWhatIf.diff.ale_delta_point_rounded).toBe(307355);

    // Add payment process
    const payWhatIf = computeWhatIf(
      BASELINE_TOOLS,
      [...BASELINE_TOOLS, "payment_process"],
      DEFAULT_ASSUMPTIONS
    );
    expect(payWhatIf.variant.scenarios["S3"].risk_score_display).toBe("18.1%");
    expect(payWhatIf.variant.scenarios["S3"].ale_point_rounded).toBe(66607);
    expect(payWhatIf.variant.total_ale_point_rounded).toBe(457842);
    expect(-payWhatIf.diff.ale_delta_point_rounded).toBe(249777);
  });

  it("finds the optimal budget plan matching Part C", () => {
    // Locked
    const planLocked = computeOptimizer(345000, false, DEFAULT_ASSUMPTIONS);
    expect(new Set(planLocked.recommended_tools)).toEqual(
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
    expect(planLocked.spend_after).toBe(343000);
    expect(planLocked.ale_after).toBe(81357);
    expect(planLocked.risk_reduction_pct).toBe(88.5);

    // Unlocked (removes SIEM)
    const planUnlocked = computeOptimizer(345000, true, DEFAULT_ASSUMPTIONS);
    expect(new Set(planUnlocked.recommended_tools)).toEqual(
      new Set([
        "email_security",
        "edr",
        "firewall",
        "mfa_owned",
        "identity_suite",
        "payment_process",
      ])
    );
    expect(planUnlocked.spend_after).toBe(258000);
    expect(planUnlocked.ale_after).toBe(81357);
  });

  it("verifies 100% parity across all 256 tool combinations with Python engine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const parityPath = path.resolve(__dirname, "../../../backend/tests/fixtures/parity.json");
    expect(fs.existsSync(parityPath)).toBe(true);
    const fixtures: {
      active_tool_ids: string[];
      total_ale_point_rounded: number;
      scenarios: Record<
        string,
        { ale_point_rounded: number; risk_score_display: string; severity: string; outcomes: string[] }
      >;
    }[] = JSON.parse(fs.readFileSync(parityPath, "utf-8"));

    expect(fixtures.length).toBe(256);

    for (let i = 0; i < fixtures.length; i++) {
      const fix = fixtures[i];
      const sim = computeRisk(fix.active_tool_ids, DEFAULT_ASSUMPTIONS, 0);
      const label = `config #${i}: [${fix.active_tool_ids.join(", ")}]`;

      expect(sim.total_ale_point_rounded, `Total ALE mismatch for ${label}`).toBe(fix.total_ale_point_rounded);

      for (const [scId, expected] of Object.entries(fix.scenarios)) {
        const sc = sim.scenarios[scId];
        expect(sc.steps.map((s) => s.outcome), `${scId} outcomes for ${label}`).toEqual(expected.outcomes);
        expect(sc.ale_point_rounded, `${scId} ALE for ${label}`).toBe(expected.ale_point_rounded);
        expect(sc.risk_score_display, `${scId} risk score for ${label}`).toBe(expected.risk_score_display);
        expect(sc.severity, `${scId} severity for ${label}`).toBe(expected.severity);
      }
    }
  });

  it("keeps the Monte Carlo range within ±3% of the Python engine (different random generators)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const refPath = path.resolve(__dirname, "../../../backend/tests/fixtures/monte_carlo_reference.json");
    const ref: { tools: string[]; iterations: number; p10: number; p90: number } = JSON.parse(
      fs.readFileSync(refPath, "utf-8")
    );
    expect(DEFAULT_MC_ITERATIONS).toBe(ref.iterations);
    expect(ref.iterations).toBe(10000);

    const sim = computeRisk(ref.tools, DEFAULT_ASSUMPTIONS);
    const tolerance = 0.03;
    expect(Math.abs(sim.total_ale_range.p10 - ref.p10) / ref.p10).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(sim.total_ale_range.p90 - ref.p90) / ref.p90).toBeLessThanOrEqual(tolerance);
  });

  it("reports consistent figures when even the required tools exceed the budget", () => {
    const plan = computeOptimizer(150000, false, DEFAULT_ASSUMPTIONS);
    const locked = TOOLS.filter((t) => t.baseline_required).map((t) => t.id);
    const sim = computeRisk(locked, DEFAULT_ASSUMPTIONS);
    expect(plan.fits_budget).toBe(false);
    expect(new Set(plan.recommended_tools)).toEqual(new Set(locked));
    expect(plan.spend_after).toBe(sim.total_spend);
    expect(plan.ale_after).toBe(sim.total_ale_point_rounded);
    expect(Number.isFinite(plan.risk_reduction_pct)).toBe(true);
  });

  it("derives the smallest plannable budget from the required tools in the data", () => {
    const required = TOOLS.filter((t) => t.baseline_required);
    expect(REQUIRED_SPEND).toBe(required.reduce((sum, t) => sum + t.annual_cost, 0));
    expect(REQUIRED_SPEND).toBe(195000);
    expect(computeOptimizer(REQUIRED_SPEND, false, DEFAULT_ASSUMPTIONS).fits_budget).toBe(true);
  });
});

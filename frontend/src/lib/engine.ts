import {
  Tool,
  Scenario,
  MappingEvidence,
  RiskAssumptions,
  SimulationResponse,
  ScenarioRiskResult,
  StepOutcome,
  StepEvidenceDetail,
  LossRange,
  ToolReturnResult,
  OptimizerPlan,
  OptimizerMove,
  WhatIfResponse,
  WhatIfDiff,
  ScenarioDiff,
  CTIDSupport,
} from "./types";

import generated from "../data/generated.json";

export interface ScenarioOverrideStep {
  blocked_by?: string[];
  detected_by?: string[];
  control_layer_team_assumption?: string;
  notes?: string;
  assumed_compromise?: boolean;
  [key: string]: unknown;
}

export interface ScenarioOverride {
  notes?: string;
  steps?: Record<string, ScenarioOverrideStep>;
}

export const TOOLS: Tool[] = generated.tools as Tool[];
export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t])
);

/** Today's setup: every tool whose status in tools.json is "active". */
export const BASELINE_TOOLS: string[] = TOOLS.filter((t) => t.status === "active").map((t) => t.id);
/** What today's setup costs per year; the optimizer's default budget. */
export const BASELINE_SPEND: number = BASELINE_TOOLS.reduce((sum, id) => sum + (TOOL_MAP[id]?.annual_cost || 0), 0);

export const TECHNIQUES: Record<
  string,
  {
    name: string;
    url: string;
    id?: string;
    description?: string;
    tactics?: string;
    platforms?: string;
    mitigations?: unknown[];
    detection_strategies?: unknown[];
    control_layer_team_assumption?: string;
  }
> = generated.techniques;

export const SCENARIOS: Scenario[] = generated.scenarios as Scenario[];
export const MAPPINGS: MappingEvidence[] = generated.mappings as MappingEvidence[];
export const NOISE_DATA: Record<string, number | null> = generated.noise as Record<string, number | null>;
export const DEFAULT_ASSUMPTIONS: RiskAssumptions = generated.assumptions as unknown as RiskAssumptions;
export const SCENARIO_OVERRIDES: Record<string, ScenarioOverride> = generated.scenario_overrides as Record<string, ScenarioOverride>;
export const SOURCE_DATA = generated.source;
export const CTID_SOURCE = generated.ctid_source;
export const CTID_REFERENCED_ROWS = generated.ctid_referenced_rows;

// --- Pure Engine Implementation ---
export function computeOutcomes(activeTools: string[]): Record<string, StepOutcome[]> {
  const activeSet = new Set(activeTools);
  const stopMap: Record<string, string[]> = {};
  const detMap: Record<
    string,
    {
      tool: string;
      effect: string;
      evType: string;
      hint?: string;
      ctid_support?: CTIDSupport[];
    }[]
  > = {};

  for (const m of MAPPINGS) {
    if (!activeSet.has(m.tool_id)) continue;
    if (!detMap[m.technique_id]) detMap[m.technique_id] = [];
    detMap[m.technique_id].push({
      tool: m.tool_id,
      effect: m.effect,
      evType: m.evidence_type,
      hint: m.mitre_mitigation_hint,
      ctid_support: m.ctid_support,
    });

    if (m.effect === "stop") {
      if (!stopMap[m.technique_id]) stopMap[m.technique_id] = [];
      stopMap[m.technique_id].push(m.tool_id);
    }
  }

  const results: Record<string, StepOutcome[]> = {};

  for (const sc of SCENARIOS) {
    results[sc.id] = sc.steps.map((st) => {
      // Check starting condition override (e.g. S3 step 1)
      const override =
        SCENARIO_OVERRIDES?.[sc.id]?.steps?.[String(st.order)] ||
        SCENARIO_OVERRIDES?.[sc.id]?.steps?.[st.order];
      if (override?.assumed_compromise || (sc.id === "S3" && st.order === 1)) {
        return {
          order: st.order,
          technique_id: st.technique_id,
          technique_name: st.technique_name,
          step: st.step,
          outcome: "starting_condition",
          stopping_tools: [],
          detecting_tools: [],
          open_routes: [],
          evidence: [],
        };
      }

      const allTechs = [st.technique_id, ...st.alternative_techniques.map((a) => a.id)];
      const allStopped = allTechs.every((t) => (stopMap[t] || []).length > 0);
      const allDetected = allTechs.every((t) => (detMap[t] || []).length > 0);

      const outcome = allStopped ? "stopped" : allDetected ? "detected" : "missed";
      const stoppingTools = Array.from(new Set(allTechs.flatMap((t) => stopMap[t] || [])));
      const detectingTools = Array.from(
        new Set(allTechs.flatMap((t) => (detMap[t] || []).map((x) => x.tool)))
      );
      const openRoutes = allTechs.filter((t) => !(stopMap[t] && stopMap[t].length > 0));

      const evidence: StepEvidenceDetail[] = allTechs.flatMap((t) =>
        (detMap[t] || []).map((x) => ({
          technique_id: t,
          tool_id: x.tool,
          effect: x.effect,
          evidence_type: x.evType,
          evidence_label:
            x.evType === "mitre_mitigation"
              ? "Based on MITRE mitigation"
              : x.evType === "mitre_detection"
              ? "Based on MITRE detection strategy"
              : x.evType === "ctid_mapping"
              ? "Backed by CTID Mappings Explorer (Microsoft 365)"
              : x.evType === "vendor_claim"
              ? "Vendor description — not tested"
              : "Team assumption — to be validated",
          mitigation_name: x.hint,
          ctid_support: x.ctid_support,
        }))
      );

      return {
        order: st.order,
        technique_id: st.technique_id,
        technique_name: st.technique_name,
        step: st.step,
        outcome,
        stopping_tools: outcome === "stopped" ? stoppingTools : [],
        detecting_tools: detectingTools,
        open_routes: openRoutes,
        evidence,
      };
    });
  }

  return results;
}

// PRNG & PERT for client-side deterministic Monte Carlo
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGamma(k: number, rnd: () => number): number {
  if (k < 1) {
    return sampleGamma(k + 1, rnd) * Math.pow(rnd() || 1e-12, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let v = 0;
    do {
      const u1 = rnd() || 1e-12;
      const u2 = rnd() || 1e-12;
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rnd() || 1e-12;
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function samplePert(a: number, m: number, c: number, rnd: () => number): number {
  if (c <= a) return a;
  const alpha = 1 + (4 * (m - a)) / (c - a);
  const beta = 1 + (4 * (c - m)) / (c - a);
  const x = sampleGamma(alpha, rnd);
  const y = sampleGamma(beta, rnd);
  return a + (x / (x + y)) * (c - a);
}

// Same iteration count as the Python engine (risk_assumptions.json → monte_carlo.iterations).
// The random generators differ (mulberry32 here, Python's Mersenne Twister there), so P10/P90 agree
// within a tested tolerance, not exactly.
export const DEFAULT_MC_ITERATIONS: number = DEFAULT_ASSUMPTIONS.monte_carlo.iterations;

export function computeRisk(
  tools: string[],
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS,
  mcIterations: number = assumptions.monte_carlo.iterations
): SimulationResponse {
  const outcomes = computeOutcomes(tools);
  const pass = assumptions.step_pass_probability;
  const scenResults: Record<string, ScenarioRiskResult> = {};
  let totalAlePoint = 0;

  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const sevAle = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const sc of SCENARIOS) {
    const steps = outcomes[sc.id];
    let p = 1.0;
    for (const st of steps) {
      p *= pass[st.outcome];
    }

    const scAssump = assumptions.scenarios[sc.id];
    const alePoint = scAssump.attempts_per_year.likely * p * scAssump.loss_per_success.likely;
    totalAlePoint += alePoint;

    const sev =
      p >= assumptions.severity_thresholds.critical
        ? "critical"
        : p >= assumptions.severity_thresholds.high
        ? "high"
        : p >= assumptions.severity_thresholds.medium
        ? "medium"
        : "low";

    sevCounts[sev]++;
    sevAle[sev] += alePoint;

    const pct = p * 100;
    const riskDisplay = pct < 0.1 ? "< 0.1%" : `${pct.toFixed(1)}%`;

    const stoppingPoints = steps.filter((s) => s.outcome === "stopped").length;
    const realSteps = steps.filter((s) => s.outcome !== "starting_condition");
    const status = realSteps.some((s) => s.outcome === "stopped")
      ? "stopped"
      : realSteps.some((s) => s.outcome === "detected")
      ? "detected"
      : "missed";

    scenResults[sc.id] = {
      id: sc.id,
      probability: p,
      risk_score_pct: pct,
      risk_score_display: riskDisplay,
      severity: sev,
      ale_point: alePoint,
      ale_point_rounded: Math.round(alePoint),
      ale_range: { p10: 0, p50: 0, p90: 0 },
      stopping_points: stoppingPoints,
      status,
      steps,
    };
  }

  // Monte Carlo range
  const rnd = mulberry32(assumptions.monte_carlo.seed || 42);
  const totals: number[] = [];
  const scenLosses: Record<string, number[]> = { S1: [], S2: [], S3: [], S4: [] };

  for (let i = 0; i < mcIterations; i++) {
    let iterTotal = 0;
    for (const sc of SCENARIOS) {
      const s = assumptions.scenarios[sc.id];
      const p = scenResults[sc.id].probability;
      const att = samplePert(s.attempts_per_year.min, s.attempts_per_year.likely, s.attempts_per_year.max, rnd);
      const loss = samplePert(s.loss_per_success.min, s.loss_per_success.likely, s.loss_per_success.max, rnd);
      const l = att * p * loss;
      scenLosses[sc.id].push(l);
      iterTotal += l;
    }
    totals.push(iterTotal);
  }

  totals.sort((a, b) => a - b);
  const p10Idx = Math.floor(mcIterations * 0.1);
  const p50Idx = Math.floor(mcIterations * 0.5);
  const p90Idx = Math.floor(mcIterations * 0.9);

  for (const sc of SCENARIOS) {
    scenLosses[sc.id].sort((a, b) => a - b);
    scenResults[sc.id].ale_range = {
      p10: scenLosses[sc.id][p10Idx],
      p50: scenLosses[sc.id][p50Idx],
      p90: scenLosses[sc.id][p90Idx],
    };
  }

  const totalRange: LossRange = {
    p10: totals[p10Idx],
    p50: totals[p50Idx],
    p90: totals[p90Idx],
  };

  const totalSpend = tools.reduce((sum, tid) => sum + (TOOL_MAP[tid]?.annual_cost || 0), 0);
  const totalNoise = tools.reduce((sum, tid) => sum + (NOISE_DATA[tid] || 0), 0);

  // Tool returns counterfactual
  const activeSet = new Set(tools);
  let lowReturnCount = 0;

  const toolReturns: ToolReturnResult[] = TOOLS.map((tool) => {
    const isActive = activeSet.has(tool.id);
    const altTools = isActive ? tools.filter((t) => t !== tool.id) : [...tools, tool.id];

    // Compute alt total ALE
    const altOutcomes = computeOutcomes(altTools);
    let altTotalAle = 0;
    for (const sc of SCENARIOS) {
      let p = 1.0;
      for (const st of altOutcomes[sc.id]) {
        p *= pass[st.outcome];
      }
      const s = assumptions.scenarios[sc.id];
      altTotalAle += s.attempts_per_year.likely * p * s.loss_per_success.likely;
    }

    const aleWithout = isActive ? altTotalAle : totalAlePoint;
    const riskReduction = isActive ? altTotalAle - totalAlePoint : totalAlePoint - altTotalAle;
    const riskReductionRounded = Math.round(riskReduction);

    let rosiPct: number | null = null;
    let rosiDisplay = "";
    let classification: "high_return" | "positive_return" | "low_return" = "positive_return";

    if (tool.annual_cost > 0) {
      const rosi = (riskReduction - tool.annual_cost) / tool.annual_cost;
      rosiPct = rosi * 100;
      rosiDisplay = `${rosi >= 0 ? "+" : ""}${Math.round(rosiPct)}%`;
      if (rosi >= 1.0) {
        classification = "high_return";
      } else if (rosi >= 0) {
        classification = "positive_return";
      } else {
        classification = "low_return";
        lowReturnCount++;
      }
    } else {
      if (riskReductionRounded > 0) {
        rosiDisplay = `Risk reduced by $${riskReductionRounded.toLocaleString()} at $0 extra cost`;
        classification = "high_return";
      } else {
        rosiDisplay = "Free";
        classification = "positive_return";
      }
    }

    let classificationLabel = "";
    if (classification === "low_return") {
      classificationLabel = tool.baseline_required
        ? "Low return in tested scenarios"
        : "Low return in tested scenarios — worth a closer look";
    } else if (classification === "high_return") {
      classificationLabel = "High return";
    } else {
      classificationLabel = "Positive return";
    }

    const baselineNote = tool.baseline_required
      ? "Required baseline control — value extends beyond tested scenarios"
      : null;

    let stoppingPoints = 0;
    let uniqueStops = 0;
    let uniqueDetections = 0;

    for (const sc of SCENARIOS) {
      const currSteps = outcomes[sc.id];
      const altSteps = altOutcomes[sc.id];
      currSteps.forEach((st, i) => {
        const altSt = altSteps[i];
        if (isActive) {
          if (st.outcome === "stopped" && st.stopping_tools.includes(tool.id)) {
            stoppingPoints++;
          }
          if (st.outcome === "stopped" && altSt.outcome !== "stopped") {
            uniqueStops++;
          }
          if (st.outcome === "detected" && altSt.outcome === "missed") {
            uniqueDetections++;
          }
        } else {
          if (altSt.outcome === "stopped" && altSt.stopping_tools.includes(tool.id)) {
            stoppingPoints++;
          }
          if (altSt.outcome === "stopped" && st.outcome !== "stopped") {
            uniqueStops++;
          }
          if (altSt.outcome === "detected" && st.outcome === "missed") {
            uniqueDetections++;
          }
        }
      });
    }

    return {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      annual_cost: tool.annual_cost,
      status: tool.status,
      baseline_required: tool.baseline_required,
      is_active: isActive,
      ale_without: aleWithout,
      risk_reduction: riskReduction,
      risk_reduction_rounded: riskReductionRounded,
      rosi_pct: rosiPct,
      rosi_display: rosiDisplay,
      classification,
      classification_label: classificationLabel,
      baseline_note: baselineNote,
      stopping_points: stoppingPoints,
      unique_stops: uniqueStops,
      unique_detections: uniqueDetections,
      overlap_stops: Math.max(0, stoppingPoints - uniqueStops),
      noise_alerts: NOISE_DATA[tool.id],
    };
  });

  toolReturns.sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    return (b.rosi_pct ?? 999999) - (a.rosi_pct ?? 999999);
  });

  return {
    active_tool_ids: tools,
    total_spend: totalSpend,
    total_ale_point: totalAlePoint,
    total_ale_point_rounded: Math.round(totalAlePoint),
    total_ale_range: totalRange,
    total_noise: totalNoise,
    scenarios: scenResults,
    severity_summary: {
      counts: sevCounts,
      ale_by_severity: sevAle,
    },
    tool_returns: toolReturns,
    tools_with_low_return_count: lowReturnCount,
  };
}

export function computeOptimizer(
  budget: number = BASELINE_SPEND,
  allowRemoveBaseline: boolean = false,
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS
): OptimizerPlan {
  const baselineSim = computeRisk(BASELINE_TOOLS, assumptions);
  const baselineAle = baselineSim.total_ale_point;
  const baselineSpend = baselineSim.total_spend;

  const locked = TOOLS.filter((t) => t.baseline_required && !allowRemoveBaseline).map((t) => t.id);
  const free = TOOLS.filter((t) => !locked.includes(t.id)).map((t) => t.id);

  let bestTools: string[] = locked;
  let bestAle = Infinity;
  let bestSpend = Infinity;

  const numFree = free.length;
  for (let mask = 0; mask < (1 << numFree); mask++) {
    const cfg = [...locked];
    for (let i = 0; i < numFree; i++) {
      if ((mask >> i) & 1) {
        cfg.push(free[i]);
      }
    }

    const spend = cfg.reduce((sum, tid) => sum + TOOL_MAP[tid].annual_cost, 0);
    if (spend > budget) continue;

    // Fast check ALE
    const outcomes = computeOutcomes(cfg);
    let ale = 0;
    for (const sc of SCENARIOS) {
      let p = 1.0;
      for (const st of outcomes[sc.id]) {
        p *= assumptions.step_pass_probability[st.outcome];
      }
      const s = assumptions.scenarios[sc.id];
      ale += s.attempts_per_year.likely * p * s.loss_per_success.likely;
    }

    if (ale < bestAle - 0.5) {
      bestAle = ale;
      bestSpend = spend;
      bestTools = cfg;
    } else if (Math.abs(ale - bestAle) <= 0.5 && spend < bestSpend) {
      bestAle = ale;
      bestSpend = spend;
      bestTools = cfg;
    }
  }

  const moves: OptimizerMove[] = [];
  BASELINE_TOOLS.filter((t) => !bestTools.includes(t)).forEach((t) => {
    moves.push({
      action: "remove",
      action_label: "Remove",
      tool_id: t,
      tool_name: TOOL_MAP[t].name,
      cost: TOOL_MAP[t].annual_cost,
      cost_display: TOOL_MAP[t].annual_cost ? `$${TOOL_MAP[t].annual_cost.toLocaleString()}/yr` : "$0",
    });
  });

  bestTools.filter((t) => !BASELINE_TOOLS.includes(t)).forEach((t) => {
    const isOwned = TOOL_MAP[t].status === "owned_not_enabled";
    moves.push({
      action: isOwned ? "enable" : "add",
      action_label: isOwned ? "Switch on" : "Add",
      tool_id: t,
      tool_name: TOOL_MAP[t].name,
      cost: TOOL_MAP[t].annual_cost,
      cost_display: TOOL_MAP[t].annual_cost ? `$${TOOL_MAP[t].annual_cost.toLocaleString()}/yr` : "$0",
    });
  });

  // If even the required (locked) tools exceed the budget, report them with their own figures.
  const fitsBudget = Number.isFinite(bestAle);
  const bestSim = computeRisk(bestTools, assumptions);
  if (!fitsBudget) {
    bestAle = bestSim.total_ale_point;
    bestSpend = bestSim.total_spend;
  }
  const reductionPct = ((1 - bestSim.total_ale_point / baselineAle) * 100);

  const removesBaseline = moves.some((m) => m.action === "remove" && TOOL_MAP[m.tool_id].baseline_required);
  const baselineWarning = removesBaseline
    ? "Removes a required baseline control — check compliance and incident-response needs first."
    : null;

  return {
    recommended_tools: bestTools,
    moves,
    spend_before: baselineSpend,
    spend_after: bestSpend,
    ale_before: Math.round(baselineAle),
    ale_after: Math.round(bestAle),
    ale_range_after: bestSim.total_ale_range,
    risk_reduction_pct: Math.round(reductionPct * 10) / 10,
    risk_reduction_sentence: fitsBudget
      ? `In this sample model, this plan reduces estimated loss exposure by ${reductionPct.toFixed(1)}%.`
      : `No plan fits a budget of $${budget.toLocaleString("en-US")}: the required baseline tools alone cost $${bestSpend.toLocaleString("en-US")}.`,
    removes_baseline_control: removesBaseline,
    baseline_warning: baselineWarning,
    fits_budget: fitsBudget,
  };
}

export function computeWhatIf(
  baselineTools: string[],
  variantTools: string[],
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS
): WhatIfResponse {
  const baseSim = computeRisk(baselineTools, assumptions);
  const varSim = computeRisk(variantTools, assumptions);

  const baseSet = new Set(baselineTools);
  const varSet = new Set(variantTools);

  const added = variantTools.filter((t) => !baseSet.has(t));
  const removed = baselineTools.filter((t) => !varSet.has(t));

  const spendDelta = varSim.total_spend - baseSim.total_spend;
  const noiseDelta = varSim.total_noise - baseSim.total_noise;
  const aleDeltaPoint = varSim.total_ale_point - baseSim.total_ale_point;
  const aleDeltaPct = baseSim.total_ale_point > 0 ? (aleDeltaPoint / baseSim.total_ale_point) * 100 : 0;

  const scenarioDiffs: Record<string, ScenarioDiff> = {};
  const changeSentences: string[] = [];

  for (const r of removed) {
    changeSentences.push(`− Removed ${TOOL_MAP[r].name}`);
  }
  for (const a of added) {
    const isOwned = TOOL_MAP[a].status === "owned_not_enabled";
    changeSentences.push(`+ ${isOwned ? "Switched on" : "Added"} ${TOOL_MAP[a].name}`);
  }

  let anyScenChanged = false;
  for (const sc of SCENARIOS) {
    const bSc = baseSim.scenarios[sc.id];
    const vSc = varSim.scenarios[sc.id];

    const changed =
      Math.abs(bSc.ale_point - vSc.ale_point) > 0.5 ||
      bSc.stopping_points !== vSc.stopping_points ||
      bSc.severity !== vSc.severity;

    if (changed) {
      anyScenChanged = true;
      const sevChange = bSc.severity !== vSc.severity ? `${bSc.severity} → ${vSc.severity}, ` : "";
      const stopChange =
        bSc.stopping_points !== vSc.stopping_points
          ? `, blocked steps ${bSc.stopping_points} → ${vSc.stopping_points}`
          : "";

      changeSentences.push(
        `${sc.name}: ${sevChange}chance ${bSc.risk_score_display} → ${vSc.risk_score_display}, estimated loss $${bSc.ale_point_rounded.toLocaleString()} → $${vSc.ale_point_rounded.toLocaleString()}${stopChange} (estimate).`
      );
    }

    scenarioDiffs[sc.id] = {
      id: sc.id,
      name: sc.name,
      baseline_severity: bSc.severity,
      variant_severity: vSc.severity,
      baseline_risk_score_display: bSc.risk_score_display,
      variant_risk_score_display: vSc.risk_score_display,
      baseline_ale: bSc.ale_point_rounded,
      variant_ale: vSc.ale_point_rounded,
      baseline_stopping_points: bSc.stopping_points,
      variant_stopping_points: vSc.stopping_points,
      changed,
    };
  }

  if (removed.length > 0 && !anyScenChanged) {
    changeSentences.push(
      "No change in any tested attack. The same steps are still blocked by other tools."
    );
  }

  const diff: WhatIfDiff = {
    added_tools: added,
    removed_tools: removed,
    spend_delta: spendDelta,
    noise_delta: noiseDelta,
    ale_delta_point: aleDeltaPoint,
    ale_delta_point_rounded: Math.round(aleDeltaPoint),
    ale_delta_pct: Math.round(aleDeltaPct * 10) / 10,
    scenario_diffs: scenarioDiffs,
    change_sentences: changeSentences,
  };

  return {
    baseline: baseSim,
    variant: varSim,
    diff,
  };
}

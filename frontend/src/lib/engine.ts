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
} from "./types";

export const TOOLS: Tool[] = [
  {
    id: "email_security",
    name: "Email Security",
    short: "Email Security",
    category: "Email",
    annual_cost: 40000,
    status: "active",
    baseline_required: true,
    description: "Filters malicious links and attachments in incoming email.",
  },
  {
    id: "edr",
    name: "Endpoint Protection (EDR)",
    short: "EDR",
    category: "Endpoint",
    annual_cost: 90000,
    status: "active",
    baseline_required: false,
    description: "Monitors and blocks malicious activity on laptops and servers.",
  },
  {
    id: "firewall",
    name: "Firewall",
    short: "Firewall",
    category: "Network",
    annual_cost: 70000,
    status: "active",
    baseline_required: true,
    description: "Controls network traffic in and out of the company.",
  },
  {
    id: "siem",
    name: "Log Monitoring (SIEM)",
    short: "SIEM",
    category: "Monitoring",
    annual_cost: 85000,
    status: "active",
    baseline_required: true,
    description: "Collects logs from many systems and raises alerts.",
  },
  {
    id: "tool_x",
    name: "Tool X — Script Control",
    short: "Tool X",
    category: "Endpoint",
    annual_cost: 60000,
    status: "active",
    baseline_required: false,
    description: "Blocks unapproved scripts on laptops.",
  },
  {
    id: "mfa_owned",
    name: "Second login check (MFA with number matching)",
    short: "MFA",
    category: "Identity",
    annual_cost: 0,
    status: "owned_not_enabled",
    baseline_required: false,
    description: "Already included in the company's current office-suite license (sample). Not switched on yet.",
  },
  {
    id: "identity_suite",
    name: "Identity Protection Suite",
    short: "Identity Suite",
    category: "Identity",
    annual_cost: 50000,
    status: "candidate",
    baseline_required: false,
    description: "A product the company is considering. Effects are based on the vendor's description and are not tested.",
  },
  {
    id: "payment_process",
    name: "Payment check by phone + Staff Training",
    short: "Payment check",
    category: "Process",
    annual_cost: 8000,
    status: "candidate",
    baseline_required: false,
    description: "Call the customer or supplier on a known number before any change to payment details.",
  },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t])
);

export const BASELINE_TOOLS = ["email_security", "edr", "firewall", "siem", "tool_x"];

export const TECHNIQUES: Record<string, { name: string; url: string }> = {
  "T1003": { name: "OS Credential Dumping", url: "https://attack.mitre.org/techniques/T1003" },
  "T1021.001": { name: "Remote Desktop Protocol", url: "https://attack.mitre.org/techniques/T1021/001" },
  "T1041": { name: "Exfiltration Over C2 Channel", url: "https://attack.mitre.org/techniques/T1041" },
  "T1059": { name: "Command and Scripting Interpreter", url: "https://attack.mitre.org/techniques/T1059" },
  "T1059.001": { name: "PowerShell", url: "https://attack.mitre.org/techniques/T1059/001" },
  "T1078.004": { name: "Cloud Accounts", url: "https://attack.mitre.org/techniques/T1078/004" },
  "T1098.005": { name: "Device Registration", url: "https://attack.mitre.org/techniques/T1098/005" },
  "T1110.003": { name: "Password Spraying", url: "https://attack.mitre.org/techniques/T1110/003" },
  "T1110.004": { name: "Credential Stuffing", url: "https://attack.mitre.org/techniques/T1110/004" },
  "T1114.002": { name: "Remote Email Collection", url: "https://attack.mitre.org/techniques/T1114/002" },
  "T1114.003": { name: "Email Forwarding Rule", url: "https://attack.mitre.org/techniques/T1114/003" },
  "T1133": { name: "External Remote Services", url: "https://attack.mitre.org/techniques/T1133" },
  "T1190": { name: "Exploit Public-Facing Application", url: "https://attack.mitre.org/techniques/T1190" },
  "T1204.002": { name: "Malicious File", url: "https://attack.mitre.org/techniques/T1204/002" },
  "T1486": { name: "Data Encrypted for Impact", url: "https://attack.mitre.org/techniques/T1486" },
  "T1490": { name: "Inhibit System Recovery", url: "https://attack.mitre.org/techniques/T1490" },
  "T1534": { name: "Internal Spearphishing", url: "https://attack.mitre.org/techniques/T1534" },
  "T1539": { name: "Steal Web Session Cookie", url: "https://attack.mitre.org/techniques/T1539" },
  "T1550.004": { name: "Web Session Cookie", url: "https://attack.mitre.org/techniques/T1550/004" },
  "T1557": { name: "Adversary-in-the-Middle", url: "https://attack.mitre.org/techniques/T1557" },
  "T1564.008": { name: "Email Hiding Rules", url: "https://attack.mitre.org/techniques/T1564/008" },
  "T1566.001": { name: "Spearphishing Attachment", url: "https://attack.mitre.org/techniques/T1566/001" },
  "T1566.002": { name: "Spearphishing Link", url: "https://attack.mitre.org/techniques/T1566/002" },
  "T1567": { name: "Exfiltration Over Web Service", url: "https://attack.mitre.org/techniques/T1567" },
  "T1570": { name: "Lateral Tool Transfer", url: "https://attack.mitre.org/techniques/T1570" },
  "T1621": { name: "Multi-Factor Authentication Request Generation", url: "https://attack.mitre.org/techniques/T1621" },
  "T1657": { name: "Financial Theft", url: "https://attack.mitre.org/techniques/T1657" },
  "T1684.001": { name: "Impersonation", url: "https://attack.mitre.org/techniques/T1684/001" },
};

export const SCENARIOS: Scenario[] = [
  {
    id: "S1",
    name: "Fake login page",
    category: "Phishing / credential theft",
    steps: [
      { order: 1, technique_id: "T1566.002", technique_name: "Spearphishing Link", step: "Employee receives an email with a link to a fake login page", alternative_techniques: [{ id: "T1566.001", name: "Spearphishing Attachment" }] },
      { order: 2, technique_id: "T1557", technique_name: "Adversary-in-the-Middle", step: "Fake page relays the real login and captures password and session", alternative_techniques: [{ id: "T1539", name: "Steal Web Session Cookie" }] },
      { order: 3, technique_id: "T1550.004", technique_name: "Web Session Cookie", step: "Attacker reuses the stolen session to enter the mailbox without a password prompt", alternative_techniques: [{ id: "T1078.004", name: "Cloud Accounts" }] },
      { order: 4, technique_id: "T1098.005", technique_name: "Device Registration", step: "Attacker registers their own device to keep access", alternative_techniques: [{ id: "T1564.008", name: "Email Hiding Rules" }] },
      { order: 5, technique_id: "T1114.002", technique_name: "Remote Email Collection", step: "Attacker reads and downloads email", alternative_techniques: [] },
    ],
  },
  {
    id: "S2",
    name: "Password guessing",
    category: "Account compromise",
    steps: [
      { order: 1, technique_id: "T1110.003", technique_name: "Password Spraying", step: "Attacker tries a few common passwords across many accounts", alternative_techniques: [{ id: "T1110.004", name: "Credential Stuffing" }] },
      { order: 2, technique_id: "T1621", technique_name: "Multi-Factor Authentication Request Generation", step: "If a second login check exists, attacker floods the employee with approval requests", alternative_techniques: [] },
      { order: 3, technique_id: "T1078.004", technique_name: "Cloud Accounts", step: "Attacker signs in as the employee", alternative_techniques: [] },
      { order: 4, technique_id: "T1114.003", technique_name: "Email Forwarding Rule", step: "Attacker sets a rule that silently forwards the employee's email", alternative_techniques: [{ id: "T1564.008", name: "Email Hiding Rules" }] },
    ],
  },
  {
    id: "S3",
    name: "Invoice fraud",
    category: "Financial fraud (account compromise)",
    steps: [
      { order: 1, technique_id: "T1078.004", technique_name: "Cloud Accounts", step: "Attacker already controls an employee mailbox (e.g. after S1 or S2)", alternative_techniques: [] },
      { order: 2, technique_id: "T1564.008", technique_name: "Email Hiding Rules", step: "Attacker hides replies from customers so the employee doesn't notice", alternative_techniques: [{ id: "T1114.003", name: "Email Forwarding Rule" }] },
      { order: 3, technique_id: "T1534", technique_name: "Internal Spearphishing", step: "Attacker emails colleagues or customers from the real account", alternative_techniques: [{ id: "T1684.001", name: "Impersonation" }] },
      { order: 4, technique_id: "T1657", technique_name: "Financial Theft", step: "Customer pays a fake invoice to the attacker's bank account", alternative_techniques: [] },
    ],
  },
  {
    id: "S4",
    name: "Ransomware",
    category: "Ransomware",
    steps: [
      { order: 1, technique_id: "T1566.001", technique_name: "Spearphishing Attachment", step: "Employee receives an email with a malicious attachment", alternative_techniques: [{ id: "T1133", name: "External Remote Services" }, { id: "T1190", name: "Exploit Public-Facing Application" }] },
      { order: 2, technique_id: "T1204.002", technique_name: "Malicious File", step: "Employee opens the file", alternative_techniques: [] },
      { order: 3, technique_id: "T1059.001", technique_name: "PowerShell", step: "Malicious script runs on the laptop", alternative_techniques: [{ id: "T1059", name: "Command and Scripting Interpreter" }] },
      { order: 4, technique_id: "T1003", technique_name: "OS Credential Dumping", step: "Attacker steals stored passwords from the machine", alternative_techniques: [] },
      { order: 5, technique_id: "T1021.001", technique_name: "Remote Desktop Protocol", step: "Attacker moves to other computers using remote desktop", alternative_techniques: [{ id: "T1570", name: "Lateral Tool Transfer" }] },
      { order: 6, technique_id: "T1567", technique_name: "Exfiltration Over Web Service", step: "Attacker copies company data out (for extortion)", alternative_techniques: [{ id: "T1041", name: "Exfiltration Over C2 Channel" }] },
      { order: 7, technique_id: "T1490", technique_name: "Inhibit System Recovery", step: "Attacker deletes backups and recovery options", alternative_techniques: [] },
      { order: 8, technique_id: "T1486", technique_name: "Data Encrypted for Impact", step: "Attacker encrypts company files and demands payment", alternative_techniques: [] },
    ],
  },
];

export const MAPPINGS: MappingEvidence[] = [
  { tool_id: "email_security", technique_id: "T1566.002", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Restrict Web-Based Content" },
  { tool_id: "email_security", technique_id: "T1566.001", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Antivirus/Antimalware" },
  { tool_id: "edr", technique_id: "T1059.001", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Execution Prevention" },
  { tool_id: "edr", technique_id: "T1059", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Execution Prevention" },
  { tool_id: "edr", technique_id: "T1003", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Credential Access Protection" },
  { tool_id: "edr", technique_id: "T1490", effect: "stop", evidence_type: "team_assumption" },
  { tool_id: "edr", technique_id: "T1486", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Behavior Prevention on Endpoint" },
  { tool_id: "edr", technique_id: "T1204.002", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "edr", technique_id: "T1539", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "edr", technique_id: "T1570", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "firewall", technique_id: "T1133", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Limit Access to Resource Over Network" },
  { tool_id: "firewall", technique_id: "T1190", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Network Segmentation" },
  { tool_id: "firewall", technique_id: "T1021.001", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Limit Access to Resource Over Network" },
  { tool_id: "firewall", technique_id: "T1567", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "firewall", technique_id: "T1041", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "siem", technique_id: "T1110.003", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "siem", technique_id: "T1110.004", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "siem", technique_id: "T1078.004", effect: "detect", evidence_type: "mitre_detection" },
  { tool_id: "tool_x", technique_id: "T1059.001", effect: "stop", evidence_type: "team_assumption" },
  { tool_id: "tool_x", technique_id: "T1059", effect: "stop", evidence_type: "team_assumption" },
  { tool_id: "mfa_owned", technique_id: "T1078.004", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Multi-factor Authentication" },
  { tool_id: "mfa_owned", technique_id: "T1621", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "Multi-factor Authentication" },
  { tool_id: "identity_suite", technique_id: "T1557", effect: "stop", evidence_type: "vendor_claim" },
  { tool_id: "identity_suite", technique_id: "T1539", effect: "stop", evidence_type: "vendor_claim" },
  { tool_id: "identity_suite", technique_id: "T1550.004", effect: "stop", evidence_type: "vendor_claim" },
  { tool_id: "identity_suite", technique_id: "T1110.003", effect: "stop", evidence_type: "vendor_claim" },
  { tool_id: "identity_suite", technique_id: "T1110.004", effect: "stop", evidence_type: "vendor_claim" },
  { tool_id: "payment_process", technique_id: "T1657", effect: "stop", evidence_type: "mitre_mitigation", mitre_mitigation_hint: "User Training" },
];

export const NOISE_DATA: Record<string, number | null> = {
  email_security: 4,
  edr: 6,
  firewall: 9,
  siem: 18,
  tool_x: 31,
  mfa_owned: 0,
  payment_process: 0,
  identity_suite: null,
};

export const DEFAULT_ASSUMPTIONS: RiskAssumptions = {
  model: "FAIR-style: Annual Loss Exposure = Attempts per year × Probability of success × Loss per success",
  step_pass_probability: {
    stopped: 0.20,
    detected: 0.60,
    missed: 0.95,
    starting_condition: 1.00,
  },
  scenarios: {
    S1: { attempts_per_year: { min: 12, likely: 24, max: 48 }, loss_per_success: { min: 30000, likely: 60000, max: 180000 } },
    S2: { attempts_per_year: { min: 6, likely: 12, max: 24 }, loss_per_success: { min: 20000, likely: 40000, max: 120000 } },
    S3: { attempts_per_year: { min: 1.5, likely: 3, max: 6 }, loss_per_success: { min: 60000, likely: 120000, max: 360000 } },
    S4: { attempts_per_year: { min: 3, likely: 6, max: 12 }, loss_per_success: { min: 750000, likely: 1500000, max: 4500000 } },
  },
  severity_thresholds: { critical: 0.50, high: 0.20, medium: 0.05 },
  monte_carlo: { iterations: 10000, seed: 42, distribution: "PERT" },
};

// --- Pure Engine Implementation ---
export function computeOutcomes(activeTools: string[]): Record<string, StepOutcome[]> {
  const activeSet = new Set(activeTools);
  const stopMap: Record<string, string[]> = {};
  const detMap: Record<string, { tool: string; effect: string; evType: string; hint?: string }[]> = {};

  for (const m of MAPPINGS) {
    if (!activeSet.has(m.tool_id)) continue;
    if (!detMap[m.technique_id]) detMap[m.technique_id] = [];
    detMap[m.technique_id].push({
      tool: m.tool_id,
      effect: m.effect,
      evType: m.evidence_type,
      hint: m.mitre_mitigation_hint,
    });

    if (m.effect === "stop") {
      if (!stopMap[m.technique_id]) stopMap[m.technique_id] = [];
      stopMap[m.technique_id].push(m.tool_id);
    }
  }

  const results: Record<string, StepOutcome[]> = {};

  for (const sc of SCENARIOS) {
    results[sc.id] = sc.steps.map((st) => {
      // S3 step 1 starting condition
      if (sc.id === "S3" && st.order === 1) {
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
              : x.evType === "vendor_claim"
              ? "Vendor description — not tested"
              : "Team assumption — to be validated",
          mitigation_name: x.hint,
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

export function computeRisk(
  tools: string[],
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS,
  mcIterations: number = 4000
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
  budget: number = 345000,
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

  const bestSim = computeRisk(bestTools, assumptions);
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
    risk_reduction_sentence: `In this sample model, this plan reduces estimated loss exposure by ${reductionPct.toFixed(1)}%.`,
    removes_baseline_control: removesBaseline,
    baseline_warning: baselineWarning,
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

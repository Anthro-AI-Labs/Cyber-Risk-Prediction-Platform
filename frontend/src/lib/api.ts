import {
  Tool,
  Scenario,
  RiskAssumptions,
  SimulationResponse,
  OptimizerPlan,
  WhatIfResponse,
  AgentNarrateResponse,
  NormalDayResponse,
  SummaryResponse,
} from "./types";
import {
  computeRisk,
  computeOptimizer,
  computeWhatIf,
  TOOLS,
  SCENARIOS,
  DEFAULT_ASSUMPTIONS,
  NOISE_DATA,
  BASELINE_SPEND,
} from "./engine";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let offlineMode = false;

export function isOfflineMode(): boolean {
  return offlineMode;
}

export function setOfflineMode(val: boolean) {
  offlineMode = val;
}

async function fetchWithFallback<T>(
  url: string,
  options: RequestInit,
  fallbackFn: () => T
): Promise<{ data: T; isOffline: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json = await res.json();
    offlineMode = false;
    return { data: json as T, isOffline: false };
  } catch {
    offlineMode = true;
    return { data: fallbackFn(), isOffline: true };
  }
}

export async function fetchTools(): Promise<{ data: Tool[]; isOffline: boolean }> {
  return fetchWithFallback<Tool[]>("/api/tools", { method: "GET" }, () => TOOLS);
}

export async function fetchScenarios(): Promise<{ data: Scenario[]; isOffline: boolean }> {
  return fetchWithFallback<Scenario[]>("/api/scenarios", { method: "GET" }, () => SCENARIOS);
}

export async function fetchAssumptions(): Promise<{ data: RiskAssumptions; isOffline: boolean }> {
  return fetchWithFallback<RiskAssumptions>(
    "/api/assumptions",
    { method: "GET" },
    () => DEFAULT_ASSUMPTIONS
  );
}

export async function updateAssumptionsApi(
  assumptions: RiskAssumptions
): Promise<{ data: RiskAssumptions; isOffline: boolean }> {
  return fetchWithFallback<RiskAssumptions>(
    "/api/assumptions",
    {
      method: "PUT",
      body: JSON.stringify(assumptions),
    },
    () => assumptions
  );
}

export async function resetAssumptionsApi(): Promise<{ data: RiskAssumptions; isOffline: boolean }> {
  return fetchWithFallback<RiskAssumptions>(
    "/api/assumptions/reset",
    { method: "POST" },
    () => DEFAULT_ASSUMPTIONS
  );
}

export async function simulateTools(
  toolIds: string[],
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS
): Promise<{ data: SimulationResponse; isOffline: boolean }> {
  return fetchWithFallback<SimulationResponse>(
    "/api/simulate",
    {
      method: "POST",
      body: JSON.stringify({ tool_ids: toolIds }),
    },
    () => computeRisk(toolIds, assumptions)
  );
}

export async function optimizeBudget(
  budget: number = BASELINE_SPEND,
  allowRemoveBaseline: boolean = false,
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS
): Promise<{ data: OptimizerPlan; isOffline: boolean }> {
  return fetchWithFallback<OptimizerPlan>(
    "/api/optimize",
    {
      method: "POST",
      body: JSON.stringify({
        budget,
        allow_remove_baseline: allowRemoveBaseline,
      }),
    },
    () => computeOptimizer(budget, allowRemoveBaseline, assumptions)
  );
}

export async function runWhatIf(
  baselineToolIds: string[],
  variantToolIds: string[],
  assumptions: RiskAssumptions = DEFAULT_ASSUMPTIONS
): Promise<{ data: WhatIfResponse; isOffline: boolean }> {
  return fetchWithFallback<WhatIfResponse>(
    "/api/whatif",
    {
      method: "POST",
      body: JSON.stringify({
        baseline_tool_ids: baselineToolIds,
        variant_tool_ids: variantToolIds,
      }),
    },
    () => computeWhatIf(baselineToolIds, variantToolIds, assumptions)
  );
}

export async function narrateScenario(
  scenarioId: string,
  toolIds: string[]
): Promise<{ data: AgentNarrateResponse; isOffline: boolean }> {
  return fetchWithFallback<AgentNarrateResponse>(
    "/api/agent/narrate",
    {
      method: "POST",
      body: JSON.stringify({
        scenario_id: scenarioId,
        tool_ids: toolIds,
      }),
    },
    () => {
      // Fallback offline narrative generator
      const sim = computeRisk(toolIds);
      const sc = sim.scenarios[scenarioId];
      const steps = sc.steps.map((st) => {
        const isBlocked = st.outcome === "stopped";
        const chosen = st.open_routes[0] || st.technique_id;
        return {
          order: st.order,
          step_description: st.step,
          technique_id: st.technique_id,
          technique_name: st.technique_name,
          chosen_route: chosen,
          chosen_route_name: chosen,
          is_blocked: isBlocked,
          responsible_tools: st.stopping_tools,
          outcome: st.outcome,
          narration: isBlocked
            ? `Simulated attacker blocked at this step by ${st.stopping_tools.join(", ")}.`
            : `Simulated attacker advances using ${chosen}.`,
        };
      });
      return {
        scenario_id: scenarioId,
        mode: "heuristic",
        badge: "AI attack simulation — results computed by the rule engine",
        steps,
      };
    }
  );
}

export async function fetchNormalDay(
  toolIds: string[]
): Promise<{ data: NormalDayResponse; isOffline: boolean }> {
  return fetchWithFallback<NormalDayResponse>(
    `/api/normal-day?tool_ids=${toolIds.join(",")}`,
    { method: "GET" },
    () => {
      const activeSet = new Set(toolIds);
      const tools = TOOLS.map((t) => ({
        tool_id: t.id,
        tool_name: t.name,
        is_active: activeSet.has(t.id),
        noise_alerts: NOISE_DATA[t.id],
      }));
      const totalNoise = toolIds.reduce((sum, tid) => sum + (NOISE_DATA[tid] || 0), 0);
      return {
        description: "A simulated normal workday. No attacks occur. Any alert is a false alarm.",
        total_active_noise: totalNoise,
        tools,
        events: [],
      };
    }
  );
}

export async function fetchSummary(
  toolIds: string[]
): Promise<{ data: SummaryResponse; isOffline: boolean }> {
  return fetchWithFallback<SummaryResponse>(
    "/api/summary",
    {
      method: "POST",
      body: JSON.stringify({ tool_ids: toolIds }),
    },
    () => {
      const sim = computeRisk(toolIds);
      return {
        source: "template",
        executive_summary: `In tested scenarios, current configuration carries an estimated annual financial loss exposure of $${sim.total_ale_point_rounded.toLocaleString()} (estimate).`,
        key_findings: [
          `Total estimated annual loss exposure is $${sim.total_ale_point_rounded.toLocaleString()} across 4 tested scenarios.`,
        ],
        recommended_actions: [
          "Review tool returns using the Budget Optimizer to maximize risk reduction.",
        ],
      };
    }
  );
}

/** Report written by the last scripts/validate.py run; falls back to the copy made by sync-data. */
export async function fetchValidationReport<T>(fallback: T): Promise<{ data: T; isOffline: boolean }> {
  return fetchWithFallback<T>("/api/meta/validation", { method: "GET" }, () => fallback);
}

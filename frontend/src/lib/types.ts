export type ToolStatus = "active" | "owned_not_enabled" | "candidate";

export interface Tool {
  id: string;
  name: string;
  category: string;
  annual_cost: number;
  status: ToolStatus;
  baseline_required: boolean;
  description: string;
  short?: string;
}

export type EvidenceType =
  | "mitre_mitigation"
  | "mitre_detection"
  | "ctid_mapping"
  | "team_assumption"
  | "vendor_claim";
export type StepOutcomeType = "stopped" | "detected" | "missed" | "starting_condition";
export type SeverityType = "critical" | "high" | "medium" | "low";

export interface CTIDSupport {
  capability_id: string;
  capability: string;
  score_category: "protect" | "detect" | "respond";
  score_value: "minimal" | "partial" | "significant";
}

export interface MappingEvidence {
  tool_id: string;
  technique_id: string;
  effect: "stop" | "detect";
  evidence_type: EvidenceType;
  mitre_mitigation_hint?: string;
  ctid_support?: CTIDSupport[];
  note?: string;
}

export interface MITRETechniqueRef {
  id: string;
  name: string;
}

export interface ScenarioStep {
  order: number;
  technique_id: string;
  technique_name: string;
  step: string;
  alternative_techniques: MITRETechniqueRef[];
  control_layer_team_assumption?: string;
}

export interface Scenario {
  id: string;
  name: string;
  category: string;
  steps: ScenarioStep[];
}

export interface StepEvidenceDetail {
  technique_id: string;
  tool_id: string;
  effect: string;
  evidence_type: string;
  evidence_label: string;
  mitigation_name?: string;
  mitigation_url?: string;
  ctid_support?: CTIDSupport[];
}

export interface StepOutcome {
  order: number;
  technique_id: string;
  technique_name: string;
  step: string;
  outcome: StepOutcomeType;
  stopping_tools: string[];
  detecting_tools: string[];
  open_routes: string[];
  evidence: StepEvidenceDetail[];
}

export interface LossRange {
  p10: number;
  p50: number;
  p90: number;
}

export interface ScenarioRiskResult {
  id: string;
  probability: number;
  risk_score_pct: number;
  risk_score_display: string;
  severity: SeverityType;
  ale_point: number;
  ale_point_rounded: number;
  ale_range: LossRange;
  stopping_points: number;
  status: "stopped" | "detected" | "missed";
  steps: StepOutcome[];
}

export interface SeveritySummary {
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  ale_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ToolReturnResult {
  id: string;
  name: string;
  category: string;
  annual_cost: number;
  status: string;
  baseline_required: boolean;
  is_active: boolean;
  ale_without: number;
  risk_reduction: number;
  risk_reduction_rounded: number;
  rosi_pct: number | null;
  rosi_display: string;
  classification: "high_return" | "positive_return" | "low_return";
  classification_label: string;
  baseline_note?: string | null;
  stopping_points: number;
  unique_stops: number;
  unique_detections: number;
  overlap_stops: number;
  noise_alerts?: number | null;
}

export interface SimulationResponse {
  active_tool_ids: string[];
  total_spend: number;
  total_ale_point: number;
  total_ale_point_rounded: number;
  total_ale_range: LossRange;
  total_noise: number;
  scenarios: Record<string, ScenarioRiskResult>;
  severity_summary: SeveritySummary;
  tool_returns: ToolReturnResult[];
  tools_with_low_return_count: number;
}

export interface SourceInfo {
  type: string;
  label: string;
  citation?: string;
  url?: string;
  range_rule?: string;
  caveat?: string;
  context?: string;
}

export interface ContextFigure {
  label: string;
  url?: string;
  use?: string;
}

export interface ScenarioParam {
  min: number;
  likely: number;
  max: number;
  source?: SourceInfo;
}

export interface ScenarioAssumptions {
  attempts_per_year: ScenarioParam;
  loss_per_success: ScenarioParam;
}

export interface StepPassProbability {
  stopped: number;
  detected: number;
  missed: number;
  starting_condition: number;
  source?: SourceInfo;
}

export interface RiskAssumptions {
  model: string;
  step_pass_probability: StepPassProbability;
  scenarios: Record<string, ScenarioAssumptions>;
  severity_thresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  monte_carlo: {
    iterations: number;
    seed: number;
    distribution: string;
  };
  context_figures?: ContextFigure[];
}

export interface OptimizerMove {
  action: "remove" | "enable" | "add";
  action_label: string;
  tool_id: string;
  tool_name: string;
  cost: number;
  cost_display: string;
}

export interface OptimizerPlan {
  recommended_tools: string[];
  moves: OptimizerMove[];
  spend_before: number;
  spend_after: number;
  ale_before: number;
  ale_after: number;
  ale_range_after: LossRange;
  risk_reduction_pct: number;
  risk_reduction_sentence: string;
  removes_baseline_control: boolean;
  baseline_warning?: string | null;
  /** false when even the required baseline tools exceed the budget */
  fits_budget?: boolean;
}

export interface AgentNarrativeStep {
  order: number;
  step_description: string;
  technique_id: string;
  technique_name: string;
  chosen_route: string;
  chosen_route_name: string;
  is_blocked: boolean;
  responsible_tools: string[];
  outcome: string;
  narration: string;
  simulation_event?: Record<string, unknown>;
}

export interface AgentNarrateResponse {
  scenario_id: string;
  mode: "heuristic" | "llm";
  badge: string;
  steps: AgentNarrativeStep[];
}

export interface ScenarioDiff {
  id: string;
  name: string;
  baseline_severity: string;
  variant_severity: string;
  baseline_risk_score_display: string;
  variant_risk_score_display: string;
  baseline_ale: number;
  variant_ale: number;
  baseline_stopping_points: number;
  variant_stopping_points: number;
  changed: boolean;
}

export interface WhatIfDiff {
  added_tools: string[];
  removed_tools: string[];
  spend_delta: number;
  noise_delta: number;
  ale_delta_point: number;
  ale_delta_point_rounded: number;
  ale_delta_pct: number;
  scenario_diffs: Record<string, ScenarioDiff>;
  change_sentences: string[];
}

export interface WhatIfResponse {
  baseline: SimulationResponse;
  variant: SimulationResponse;
  diff: WhatIfDiff;
}

export interface NormalDayEvent {
  id: string;
  name: string;
  count: number;
  alerting_tools: string[];
}

export interface NormalDayToolNoise {
  tool_id: string;
  tool_name: string;
  is_active: boolean;
  noise_alerts: number | null;
  status_note?: string | null;
}

export interface NormalDayResponse {
  description: string;
  total_active_noise: number;
  tools: NormalDayToolNoise[];
  events: NormalDayEvent[];
}

export interface SummaryResponse {
  source: "template" | "llm";
  executive_summary: string;
  key_findings: string[];
  recommended_actions: string[];
}

export interface EvidenceReportDowngrade {
  tool_id: string;
  technique_id: string;
  original_evidence_type: string;
  downgraded_to: string;
  reason: string;
}

export interface EvidenceReport {
  validated_mappings_count: number;
  downgrades: EvidenceReportDowngrade[];
}

export interface WhatIfRequest {
  baseline_tool_ids?: string[];
  variant_tool_ids?: string[];
  change?: Record<string, unknown>;
}

export type PresentationMode = "simple" | "advanced";

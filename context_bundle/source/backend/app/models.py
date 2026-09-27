from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

# --- MITRE ATT&CK Models ---
class MITREMitigation(BaseModel):
    id: str
    name: str
    how: str
    url: str

class MITREDetectionStrategy(BaseModel):
    id: str
    name: str
    url: str

class MITRETechniqueRef(BaseModel):
    id: str
    name: str

class MITRETechnique(BaseModel):
    id: str
    name: str
    tactics: str
    platforms: str
    description: str
    url: str
    mitigations: List[MITREMitigation] = []
    detection_strategies: List[MITREDetectionStrategy] = []
    known_groups_count: int
    used_by_scattered_spider: bool
    known_groups_sample: List[str] = []
    control_layer_team_assumption: Optional[str] = None

class ScenarioStep(BaseModel):
    order: int
    technique_id: str
    technique_name: str
    step: str
    alternative_techniques: List[MITRETechniqueRef] = []
    control_layer_team_assumption: Optional[str] = None

class StepOverride(BaseModel):
    assumed_compromise: Optional[bool] = None
    note: Optional[str] = None

class ScenarioOverride(BaseModel):
    steps: Dict[str, StepOverride]

class Scenario(BaseModel):
    id: str
    name: str
    category: str
    steps: List[ScenarioStep]

class MITRESource(BaseModel):
    name: str
    version: str
    released: str
    url: str
    data: str
    terms: str
    attribution: str

class MitreAttackDataset(BaseModel):
    source: MITRESource
    scenarios: List[Scenario]
    techniques: List[MITRETechnique]
    notes: Optional[str] = None


# --- CTID Models ---
class CTIDSupport(BaseModel):
    capability_id: str
    capability: str
    score_category: Literal["protect", "detect", "respond"]
    score_value: Literal["minimal", "partial", "significant"]

class CTIDMappingRow(BaseModel):
    capability_id: str
    attack_object_id: str
    score_category: str
    score_value: str
    comments: Optional[str] = None
    capability_description: Optional[str] = None
    mapping_type: Optional[str] = None
    attack_object_name: Optional[str] = None

class CTIDSubsetFile(BaseModel):
    metadata: Optional[Dict[str, Any]] = None
    mapping_objects: List[CTIDMappingRow]

# --- Tools and Mappings ---
class Tool(BaseModel):
    id: str
    name: str
    category: str
    annual_cost: int
    status: Literal["active", "owned_not_enabled", "candidate"]
    baseline_required: bool
    description: str

class MappingEvidence(BaseModel):
    technique_id: str
    tool_id: str
    effect: Literal["stop", "detect"]
    evidence_type: Literal[
        "mitre_mitigation",
        "mitre_detection",
        "ctid_mapping",
        "team_assumption",
        "vendor_claim",
    ]
    mitre_mitigation_hint: Optional[str] = None
    ctid_support: Optional[List[CTIDSupport]] = None
    note: Optional[str] = None
    attached_mitigation: Optional[MITREMitigation] = None
    attached_detections: List[MITREDetectionStrategy] = []
    attached_ctid: List[CTIDSupport] = []

class EvidenceDowngrade(BaseModel):
    tool_id: str
    technique_id: str
    original_evidence_type: str
    downgraded_to: str
    reason: str

class EvidenceReport(BaseModel):
    validated_mappings_count: int
    downgrades: List[EvidenceDowngrade] = []

# --- Assumptions ---
class SourceInfo(BaseModel):
    type: str
    label: str
    citation: Optional[str] = None
    url: Optional[str] = None
    range_rule: Optional[str] = None
    caveat: Optional[str] = None
    context: Optional[str] = None

class ContextFigure(BaseModel):
    label: str
    url: Optional[str] = None
    use: Optional[str] = None

class ScenarioParam(BaseModel):
    min: float
    likely: float
    max: float
    source: Optional[SourceInfo] = None

class ScenarioAssumptions(BaseModel):
    attempts_per_year: ScenarioParam
    loss_per_success: ScenarioParam

class StepPassProbability(BaseModel):
    stopped: float = 0.20
    detected: float = 0.60
    missed: float = 0.95
    starting_condition: float = 1.00
    explanation: Optional[str] = Field(default=None, alias="_explanation")
    source: Optional[SourceInfo] = None

class SeverityThresholds(BaseModel):
    critical: float = 0.50
    high: float = 0.20
    medium: float = 0.05

class MonteCarloConfig(BaseModel):
    iterations: int = 10000
    seed: int = 42
    distribution: str = "PERT"

class RiskAssumptions(BaseModel):
    model: str
    step_pass_probability: StepPassProbability
    scenarios: Dict[str, ScenarioAssumptions]
    severity_thresholds: SeverityThresholds
    monte_carlo: MonteCarloConfig
    context_figures: List[ContextFigure] = []

# --- Engine Step & Scenario Evaluation ---
class StepEvidenceDetail(BaseModel):
    technique_id: str
    tool_id: str
    effect: str
    evidence_type: str
    evidence_label: str
    mitigation_name: Optional[str] = None
    mitigation_url: Optional[str] = None
    ctid_support: Optional[List[CTIDSupport]] = None

class StepOutcome(BaseModel):
    order: int
    technique_id: str
    technique_name: str
    step: str
    outcome: Literal["stopped", "detected", "missed", "starting_condition"]
    stopping_tools: List[str] = []
    detecting_tools: List[str] = []
    open_routes: List[str] = []
    evidence: List[StepEvidenceDetail] = []

class ScenarioEvaluation(BaseModel):
    id: str
    name: str
    category: str
    status: Literal["stopped", "detected", "missed"]
    steps: List[StepOutcome]
    stopping_points: int
    evaluated_steps_count: int

# --- Risk & Loss Exposure Models ---
class LossRange(BaseModel):
    p10: float
    p50: float
    p90: float

class ScenarioRiskResult(BaseModel):
    id: str
    probability: float
    risk_score_pct: float
    risk_score_display: str
    severity: Literal["critical", "high", "medium", "low"]
    ale_point: float
    ale_point_rounded: int
    ale_range: LossRange
    stopping_points: int
    status: Literal["stopped", "detected", "missed"]
    steps: List[StepOutcome]

class SeverityCount(BaseModel):
    critical: int
    high: int
    medium: int
    low: int

class SeverityALE(BaseModel):
    critical: float
    high: float
    medium: float
    low: float

class SeveritySummary(BaseModel):
    counts: SeverityCount
    ale_by_severity: SeverityALE

class ToolReturnResult(BaseModel):
    id: str
    name: str
    category: str
    annual_cost: int
    status: str
    baseline_required: bool
    is_active: bool
    ale_without: float
    risk_reduction: float
    risk_reduction_rounded: int
    rosi_pct: Optional[float] = None
    rosi_display: str
    classification: Literal["high_return", "positive_return", "low_return"]
    classification_label: str
    baseline_note: Optional[str] = None
    stopping_points: int
    unique_stops: int
    unique_detections: int
    overlap_stops: int
    noise_alerts: Optional[int] = None

class SimulationResponse(BaseModel):
    active_tool_ids: List[str]
    total_spend: int
    total_ale_point: float
    total_ale_point_rounded: int
    total_ale_range: LossRange
    total_noise: int
    scenarios: Dict[str, ScenarioRiskResult]
    severity_summary: SeveritySummary
    tool_returns: List[ToolReturnResult]
    tools_with_low_return_count: int

# --- What-If Models ---
class WhatIfRequest(BaseModel):
    baseline_tool_ids: List[str]
    variant_tool_ids: Optional[List[str]] = None
    change: Optional[Dict[str, Any]] = None

class ScenarioDiff(BaseModel):
    id: str
    name: str
    baseline_severity: str
    variant_severity: str
    baseline_risk_score_display: str
    variant_risk_score_display: str
    baseline_ale: int
    variant_ale: int
    baseline_stopping_points: int
    variant_stopping_points: int
    changed: bool

class WhatIfDiff(BaseModel):
    added_tools: List[str]
    removed_tools: List[str]
    spend_delta: int
    noise_delta: int
    ale_delta_point: float
    ale_delta_point_rounded: int
    ale_delta_pct: float
    scenario_diffs: Dict[str, ScenarioDiff]
    change_sentences: List[str]

class WhatIfResponse(BaseModel):
    baseline: SimulationResponse
    variant: SimulationResponse
    diff: WhatIfDiff

# --- Optimizer Models ---
class OptimizerMove(BaseModel):
    action: Literal["remove", "enable", "add"]
    action_label: str
    tool_id: str
    tool_name: str
    cost: int
    cost_display: str

class OptimizerRequest(BaseModel):
    budget: Optional[int] = None
    allow_remove_baseline: bool = False

class OptimizerPlan(BaseModel):
    recommended_tools: List[str]
    moves: List[OptimizerMove]
    spend_before: int
    spend_after: int
    ale_before: int
    ale_after: int
    ale_range_after: LossRange
    risk_reduction_pct: float
    risk_reduction_sentence: str
    removes_baseline_control: bool
    baseline_warning: Optional[str] = None

# --- AI Attacker Agent Models ---
class AgentNarrateRequest(BaseModel):
    scenario_id: str
    tool_ids: List[str]

class AgentNarrativeStep(BaseModel):
    order: int
    step_description: str
    technique_id: str
    technique_name: str
    chosen_route: str
    chosen_route_name: str
    is_blocked: bool
    responsible_tools: List[str]
    outcome: str
    narration: str
    simulation_event: Optional[Dict[str, Any]] = None

class AgentNarrateResponse(BaseModel):
    scenario_id: str
    mode: Literal["heuristic", "llm"]
    badge: str = "AI attack simulation — results computed by the rule engine"
    steps: List[AgentNarrativeStep]

# --- Noise / Normal Day Models ---
class NormalDayEvent(BaseModel):
    id: str
    name: str
    count: int
    alerting_tools: List[str]

class NormalDayDataset(BaseModel):
    description: str
    event_types: List[NormalDayEvent]

class NormalDayToolNoise(BaseModel):
    tool_id: str
    tool_name: str
    is_active: bool
    noise_alerts: Optional[int]
    status_note: Optional[str] = None

class NormalDayResponse(BaseModel):
    description: str
    total_active_noise: int
    tools: List[NormalDayToolNoise]
    events: List[NormalDayEvent]

# --- Summary Models ---
class SummaryRequest(BaseModel):
    tool_ids: List[str]

class SummaryResponse(BaseModel):
    source: Literal["template", "llm"]
    executive_summary: str
    key_findings: List[str]
    recommended_actions: List[str]

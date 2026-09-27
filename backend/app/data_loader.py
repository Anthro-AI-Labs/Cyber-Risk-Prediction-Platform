import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Any

from app.models import (
    Tool,
    Scenario,
    MITRETechnique,
    MappingEvidence,
    EvidenceDowngrade,
    EvidenceReport,
    RiskAssumptions,
    NormalDayEvent,
    MITRESource,
    MITREMitigation,
    MITREDetectionStrategy,
    CTIDSupport,
)

logger = logging.getLogger("roi_cyber_validator.data_loader")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

EVIDENCE_LABELS = {
    "mitre_mitigation": "Based on MITRE mitigation",
    "mitre_detection": "Based on MITRE detection strategy",
    "ctid_mapping": "Backed by CTID Mappings Explorer (Microsoft 365)",
    "team_assumption": "Team assumption — to be validated",
    "vendor_claim": "Vendor description — not tested",
}

MANIFEST_NAME = "MANIFEST.sha256"


class DataIntegrityError(RuntimeError):
    """Raised when a provided data file does not match data/MANIFEST.sha256."""


def verify_data_manifest(data_dir: Path) -> Dict[str, str]:
    """Check every file listed in MANIFEST.sha256 (sha256sum format) and return {path: sha}.

    Raises DataIntegrityError listing every missing or mismatched file.
    """
    manifest_path = data_dir / MANIFEST_NAME
    if not manifest_path.exists():
        raise DataIntegrityError(f"Data manifest missing: {manifest_path}")

    expected: Dict[str, str] = {}
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        sha, rel = line.split(None, 1)
        expected[rel.strip()] = sha.lower()
    if not expected:
        raise DataIntegrityError(f"Data manifest is empty: {manifest_path}")

    problems = []
    for rel, sha in expected.items():
        path = data_dir / rel
        if not path.exists():
            problems.append(f"  {rel}: file missing")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != sha:
            problems.append(f"  {rel}: expected {sha}, got {actual}")
    if problems:
        raise DataIntegrityError(
            "Provided data files do not match data/MANIFEST.sha256 — do not edit them; "
            "restore the originals:\n" + "\n".join(problems)
        )
    return expected


class DataLoader:
    def __init__(self, data_dir: Optional[Path] = None, verify_integrity: bool = True):
        self.data_dir = data_dir or DATA_DIR
        if verify_integrity:
            verify_data_manifest(self.data_dir)
        self.mitre_source: Optional[MITRESource] = None
        self.ctid_source: Optional[Dict[str, Any]] = None
        self.ctid_index: Dict[tuple, Dict[str, Any]] = {}
        self.techniques: Dict[str, MITRETechnique] = {}
        self.scenarios: Dict[str, Scenario] = {}
        self.scenario_overrides: Dict[str, Any] = {}
        self.tools: Dict[str, Tool] = {}
        self.mappings: List[MappingEvidence] = []
        self.evidence_report: EvidenceReport = EvidenceReport(validated_mappings_count=0, downgrades=[])
        self.sample_assumptions_raw: Dict[str, Any] = {}
        self.current_assumptions: Optional[RiskAssumptions] = None
        self.normal_day_events: List[NormalDayEvent] = []
        self.normal_day_desc: str = ""

        self.load_all()

    def load_all(self):
        self._load_mitre()
        self._load_ctid()
        self._load_scenario_overrides()
        self._load_tools()
        self._load_mappings()
        self._load_assumptions()
        self._load_normal_day()

    def _load_mitre(self):
        mitre_path = self.data_dir / "mitre" / "MITRE_ATTACK_demo_subset.json"
        if not mitre_path.exists():
            raise FileNotFoundError(
                f"Required MITRE ATT&CK demo subset file missing at: {mitre_path}. "
                f"Please ensure MITRE_ATTACK_demo_subset.json is placed in backend/data/mitre/."
            )

        with open(mitre_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.mitre_source = MITRESource(**data.get("source", {}))

        self.techniques = {}
        for t_dict in data.get("techniques", []):
            t = MITRETechnique(**t_dict)
            self.techniques[t.id] = t

        self.scenarios = {}
        for s_dict in data.get("scenarios", []):
            s = Scenario(**s_dict)
            self.scenarios[s.id] = s

    def _load_ctid(self):
        ctid_path = self.data_dir / "ctid" / "ctid_m365_mappings_subset.json"
        if not ctid_path.exists():
            raise FileNotFoundError(
                f"Required CTID M365 mappings subset file missing at: {ctid_path}. "
                f"Please ensure ctid_m365_mappings_subset.json is placed in backend/data/ctid/."
            )

        with open(ctid_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.ctid_source = data.get("source", {})
        self.ctid_index = {}
        for obj in data.get("mapping_objects", []):
            key = (obj["capability_id"], obj["attack_object_id"])
            self.ctid_index[key] = obj

    def _load_scenario_overrides(self):
        path = self.data_dir / "scenario_overrides.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                self.scenario_overrides = json.load(f)
        else:
            self.scenario_overrides = {}

    def _load_tools(self):
        path = self.data_dir / "tools.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing tools data file at {path}")
        with open(path, "r", encoding="utf-8") as f:
            raw_tools = json.load(f)
        self.tools = {t["id"]: Tool(**t) for t in raw_tools}

    def _load_mappings(self):
        path = self.data_dir / "mappings.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing mappings data file at {path}")
        with open(path, "r", encoding="utf-8") as f:
            raw_mappings = json.load(f)

        self.mappings = []
        downgrades: List[EvidenceDowngrade] = []

        for m in raw_mappings:
            tool_id = m["tool_id"]
            technique_id = m["technique_id"]
            effect = m["effect"]
            evidence_type = m["evidence_type"]
            mitre_hint = m.get("mitre_mitigation_hint")
            note = m.get("note")
            raw_ctid_support = m.get("ctid_support") or []

            attached_mitigation: Optional[MITREMitigation] = None
            attached_detections: List[MITREDetectionStrategy] = []
            validated_ctid_support: List[CTIDSupport] = []

            tech = self.techniques.get(technique_id)

            # CTID validation
            has_ctid_failure = False
            ctid_failure_reason = ""
            if raw_ctid_support:
                for cs in raw_ctid_support:
                    cap_id = cs.get("capability_id")
                    key = (cap_id, technique_id)
                    if key not in self.ctid_index:
                        has_ctid_failure = True
                        ctid_failure_reason = f"CTID mapping for {cap_id} on {technique_id} not found"
                        break
                    row = self.ctid_index[key]
                    if row.get("score_category") != "protect":
                        has_ctid_failure = True
                        ctid_failure_reason = f"CTID mapping {cap_id} on {technique_id} has score_category '{row.get('score_category')}', expected 'protect'"
                        break
                    if row.get("score_value") != cs.get("score_value"):
                        has_ctid_failure = True
                        ctid_failure_reason = f"CTID mapping {cap_id} on {technique_id} score_value '{row.get('score_value')}' != stated '{cs.get('score_value')}'"
                        break
                    if effect == "stop" and (row.get("score_category") != "protect" or row.get("score_value") != "significant"):
                        has_ctid_failure = True
                        ctid_failure_reason = f"CTID mapping {cap_id} on {technique_id} cannot count as 'stop' with score '{row.get('score_value')}'"
                        break
                    validated_ctid_support.append(CTIDSupport(**cs))
            elif evidence_type == "ctid_mapping":
                has_ctid_failure = True
                ctid_failure_reason = f"No ctid_support specified for ctid_mapping on {technique_id}"

            if evidence_type == "ctid_mapping":
                if has_ctid_failure or not validated_ctid_support:
                    logger.warning(
                        f"Downgrading CTID mapping for {tool_id} on {technique_id}: {ctid_failure_reason}"
                    )
                    downgrades.append(
                        EvidenceDowngrade(
                            tool_id=tool_id,
                            technique_id=technique_id,
                            original_evidence_type=evidence_type,
                            downgraded_to="team_assumption",
                            reason=ctid_failure_reason,
                        )
                    )
                    evidence_type = "team_assumption"
                    validated_ctid_support = []

            if evidence_type == "mitre_mitigation":
                found_mit = None
                if tech and mitre_hint:
                    hint_lower = mitre_hint.strip().lower()
                    for mit in tech.mitigations:
                        if hint_lower in mit.name.lower():
                            found_mit = mit
                            break

                if found_mit:
                    attached_mitigation = found_mit
                else:
                    downgrade_reason = (
                        f"Mitigation hint '{mitre_hint}' not matched in technique {technique_id} mitigations"
                        if tech else f"Technique {technique_id} not found"
                    )
                    logger.warning(
                        f"Downgrading mapping for {tool_id} on {technique_id}: {downgrade_reason}"
                    )
                    downgrades.append(
                        EvidenceDowngrade(
                            tool_id=tool_id,
                            technique_id=technique_id,
                            original_evidence_type=evidence_type,
                            downgraded_to="team_assumption",
                            reason=downgrade_reason,
                        )
                    )
                    evidence_type = "team_assumption"

            elif evidence_type == "mitre_detection":
                if tech and tech.detection_strategies:
                    attached_detections = tech.detection_strategies
                else:
                    downgrade_reason = (
                        f"No detection strategies documented for {technique_id}"
                        if tech else f"Technique {technique_id} not found"
                    )
                    logger.warning(
                        f"Downgrading detection mapping for {tool_id} on {technique_id}: {downgrade_reason}"
                    )
                    downgrades.append(
                        EvidenceDowngrade(
                            tool_id=tool_id,
                            technique_id=technique_id,
                            original_evidence_type=evidence_type,
                            downgraded_to="team_assumption",
                            reason=downgrade_reason,
                        )
                    )
                    evidence_type = "team_assumption"

            self.mappings.append(
                MappingEvidence(
                    technique_id=technique_id,
                    tool_id=tool_id,
                    effect=effect,
                    evidence_type=evidence_type,
                    mitre_mitigation_hint=mitre_hint,
                    ctid_support=validated_ctid_support if validated_ctid_support else None,
                    note=note,
                    attached_mitigation=attached_mitigation,
                    attached_detections=attached_detections,
                    attached_ctid=validated_ctid_support,
                )
            )

        self.evidence_report = EvidenceReport(
            validated_mappings_count=len(self.mappings),
            downgrades=downgrades,
        )

    def _load_assumptions(self):
        path = self.data_dir / "risk_assumptions.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing risk assumptions file at {path}")
        with open(path, "r", encoding="utf-8") as f:
            self.sample_assumptions_raw = json.load(f)
        self.current_assumptions = RiskAssumptions(**self.sample_assumptions_raw)

    def reset_assumptions(self) -> RiskAssumptions:
        self.current_assumptions = RiskAssumptions(**self.sample_assumptions_raw)
        return self.current_assumptions

    def update_assumptions(self, new_assumptions: RiskAssumptions) -> RiskAssumptions:
        self.current_assumptions = new_assumptions
        return self.current_assumptions

    def _load_normal_day(self):
        path = self.data_dir / "normal_day.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing normal day file at {path}")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.normal_day_desc = data.get("description", "")
        self.normal_day_events = [NormalDayEvent(**e) for e in data.get("event_types", [])]

    def get_tool_noise(self, tool_id: str) -> Optional[int]:
        if tool_id == "identity_suite":
            return None
        return sum(
            e.count for e in self.normal_day_events if tool_id in e.alerting_tools
        )

# Global singleton
data_loader = DataLoader()

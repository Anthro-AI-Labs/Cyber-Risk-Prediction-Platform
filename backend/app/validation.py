import copy
import hashlib
import json
import random
import re
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import TypeAdapter

from app.data_loader import EVIDENCE_LABELS, data_loader
from app.models import (
    CTIDSubsetFile,
    MappingEvidence,
    MitreAttackDataset,
    NormalDayDataset,
    RiskAssumptions,
    ScenarioOverride,
    Tool,
)
from app.optimizer import run_optimizer
from app.risk import compute_simulation
from app.summary import BANNED_PHRASES

# ---------------------------------------------------------------------------------------------
# Every result in this module is computed. A check's "status" is PASS only when its computed
# result meets its criterion; anything else is FAIL (or NOT_RUN when an input such as the test
# run or the TypeScript engine output was not supplied). scripts/validate.py supplies those inputs,
# writes validation_report.json and exits non-zero when any check is not PASS.
# ---------------------------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = REPO_ROOT / "backend" / "data" / ".cache"
MITRE_URL = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-19.2.json"
CTID_URL = "https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/main/mappings/m365/attack-16.1/m365-07.18.2025/enterprise/m365-07.18.2025_attack-16.1-enterprise.json"
EXPECTED_MITRE_SHA256 = "2725bd45060e1f9bb6cad0fedf55102f76c65d0a8bcfbba1e678e32ca6128eb3"
EXPECTED_CTID_SHA256 = "f0742a06e782d6e808e6abb08beba61c14a7dd635a98edcb04b19349777ff059"


def _fetch_or_cache(url: str, filename: str) -> Optional[bytes]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / filename
    if cache_path.exists():
        return cache_path.read_bytes()

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Cyber-Risk-Validator/3.2"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            cache_path.write_bytes(data)
            return data
    except Exception:
        return None


MITRE_SUBSET_PATH = REPO_ROOT / "backend" / "data" / "mitre" / "MITRE_ATTACK_demo_subset.json"


def _mitre_ref(obj: Dict[str, Any]) -> Dict[str, Any]:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref
    return {}


def _active(obj: Optional[Dict[str, Any]]) -> bool:
    return bool(obj) and not obj.get("revoked", False) and not obj.get("x_mitre_deprecated", False)


def check_mitre_fidelity(subset: Dict[str, Any], stix_objects: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compare the MITRE demo subset against the official ATT&CK STIX bundle.

    Three checks per technique:
      1. identity  — the ID exists in STIX, is active, and the technique URL is identical;
      2. name      — the technique name is identical;
      3. references — the set of mitigation IDs is identical, every mitigation's name and URL is
                      identical, and the detection-strategy IDs, names and URLs are identical.
    Plus one check per scenario step reference (primary and alternative techniques): the ID exists,
    is active, and the name used in the step is identical.

    Returns counts plus a list of human-readable failures (empty when everything matches).
    """
    by_stix_id = {o.get("id"): o for o in stix_objects}
    by_ext: Dict[str, Dict[str, Dict[str, Any]]] = {"attack-pattern": {}, "course-of-action": {}, "x-mitre-detection-strategy": {}}
    for o in stix_objects:
        kind = o.get("type")
        if kind in by_ext:
            ext_id = _mitre_ref(o).get("external_id")
            if ext_id:
                by_ext[kind][ext_id] = o
    patterns = by_ext["attack-pattern"]
    mitigations = by_ext["course-of-action"]
    detections = by_ext["x-mitre-detection-strategy"]

    related: Dict[Tuple[str, str], set] = {}
    for o in stix_objects:
        if o.get("type") != "relationship" or not _active(o):
            continue
        rel = o.get("relationship_type")
        src = by_stix_id.get(o.get("source_ref"))
        if rel not in ("mitigates", "detects") or not _active(src):
            continue
        ext_id = _mitre_ref(src).get("external_id")
        if ext_id:
            related.setdefault((rel, o.get("target_ref")), set()).add(ext_id)

    failures: List[str] = []
    field_passed = field_total = 0
    for tech in subset.get("techniques", []):
        tid = tech.get("id")
        ap = patterns.get(tid)
        field_total += 3

        if _active(ap) and _mitre_ref(ap).get("url") == tech.get("url"):
            field_passed += 1
        elif not _active(ap):
            failures.append(f"{tid}: technique missing, revoked or deprecated in STIX")
        else:
            failures.append(f"{tid}: technique url {tech.get('url')!r} != official {_mitre_ref(ap).get('url')!r}")

        if ap and ap.get("name") == tech.get("name"):
            field_passed += 1
        else:
            failures.append(f"{tid}: name {tech.get('name')!r} != official {ap.get('name') if ap else None!r}")

        ref_problems: List[str] = []
        stix_ref = ap.get("id") if ap else ""
        ours_m = {m.get("id") for m in tech.get("mitigations", [])}
        official_m = related.get(("mitigates", stix_ref), set())
        if ours_m != official_m:
            ref_problems.append(f"mitigation set differs (only ours: {sorted(ours_m - official_m)}, only official: {sorted(official_m - ours_m)})")
        for m in tech.get("mitigations", []):
            off = mitigations.get(m.get("id"))
            if not off:
                ref_problems.append(f"mitigation {m.get('id')} not in STIX")
                continue
            if off.get("name") != m.get("name"):
                ref_problems.append(f"mitigation {m.get('id')} name {m.get('name')!r} != official {off.get('name')!r}")
            if _mitre_ref(off).get("url") != m.get("url"):
                ref_problems.append(f"mitigation {m.get('id')} url {m.get('url')!r} != official {_mitre_ref(off).get('url')!r}")
        ours_d = {d.get("id") for d in tech.get("detection_strategies", [])}
        official_d = related.get(("detects", stix_ref), set())
        if ours_d != official_d:
            ref_problems.append(f"detection-strategy set differs (only ours: {sorted(ours_d - official_d)}, only official: {sorted(official_d - ours_d)})")
        for d in tech.get("detection_strategies", []):
            off = detections.get(d.get("id"))
            if not off:
                ref_problems.append(f"detection strategy {d.get('id')} not in STIX")
                continue
            if off.get("name") != d.get("name") or _mitre_ref(off).get("url") != d.get("url"):
                ref_problems.append(f"detection strategy {d.get('id')} name/url differs from official")
        if ref_problems:
            failures.extend(f"{tid}: {p}" for p in ref_problems)
        else:
            field_passed += 1

    step_passed = step_total = 0
    for sc in subset.get("scenarios", []):
        for st in sc.get("steps", []):
            refs = [(st.get("technique_id"), st.get("technique_name"))]
            refs += [(a.get("id"), a.get("name")) for a in st.get("alternative_techniques", [])]
            for ref_id, ref_name in refs:
                step_total += 1
                ap = patterns.get(ref_id)
                if _active(ap) and ap.get("name") == ref_name:
                    step_passed += 1
                else:
                    failures.append(f"{sc.get('id')} step {st.get('order')}: reference {ref_id} {ref_name!r} does not match STIX")

    return {
        "technique_count": len(subset.get("techniques", [])),
        "field_checks_passed": field_passed,
        "field_checks_total": field_total,
        "step_checks_passed": step_passed,
        "step_checks_total": step_total,
        "passed": field_passed + step_passed,
        "total": field_total + step_total,
        "failures": failures,
    }



CTID_SUBSET_PATH = REPO_ROOT / "backend" / "data" / "ctid" / "ctid_m365_mappings_subset.json"
BASELINE_TOOLS = ["email_security", "edr", "firewall", "siem", "tool_x"]

# Published inputs whose derivation is re-checked (FBI IC3 2025 Internet Crime Report).
IC3_BEC_LOSSES = 3_046_598_558
IC3_BEC_COMPLAINTS = 24_768

# Sensitivity design (docs/REFERENCE_FACTS.md §4).
OAT_MULTIPLIERS = (0.5, 1.5)
JOINT_RANGE = (0.5, 1.5)
JOINT_RUNS = 500
JOINT_SEED = 7

OFFICIAL_EVIDENCE_TYPES = ("mitre_mitigation", "mitre_detection", "ctid_mapping")
ALL_EVIDENCE_TYPES = OFFICIAL_EVIDENCE_TYPES + ("team_assumption", "vendor_claim")


def _pct(passed: int, total: int) -> float:
    return (passed / total) * 100.0 if total else 0.0


def _check(passed: int, total: int, **extra: Any) -> Dict[str, Any]:
    """A pass/fail check: PASS iff every item passed (and there was at least one item)."""
    out = {"passed": passed, "total": total, "pct": _pct(passed, total),
           "status": "PASS" if total > 0 and passed == total else "FAIL"}
    out.update(extra)
    return out


def _not_run(reason: str, **extra: Any) -> Dict[str, Any]:
    out = {"passed": 0, "total": 0, "pct": 0.0, "status": "NOT_RUN", "meaning": reason, "evidence": reason}
    out.update(extra)
    return out


def _simulate(tool_ids: List[str], assumptions: RiskAssumptions):
    return compute_simulation(
        active_tool_ids=tool_ids,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )


def _optimize(assumptions: RiskAssumptions):
    return run_optimizer(
        budget=None,
        allow_remove_baseline=False,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=assumptions,
    )


def _point_assumptions() -> RiskAssumptions:
    a = copy.deepcopy(data_loader.current_assumptions)
    a.monte_carlo.iterations = 0
    return a


# ---------------------------------------------------------------------------------------------
# D1. Source fidelity
# ---------------------------------------------------------------------------------------------

def check_ctid_fidelity(subset_rows: List[Dict[str, Any]], official_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Every subset row must appear in the official file with identical values on every subset field."""
    def key(row: Dict[str, Any], fields: List[str]) -> str:
        return json.dumps({f: row.get(f) for f in fields}, sort_keys=True)

    failures: List[str] = []
    passed = 0
    fields = sorted({f for r in subset_rows for f in r})
    official_keys = {key(r, fields) for r in official_rows}
    for r in subset_rows:
        if key(r, fields) in official_keys:
            passed += 1
        else:
            failures.append(f"{r.get('capability_id')} / {r.get('attack_object_id')}: no identical official row")
    return {"passed": passed, "total": len(subset_rows), "fields_compared": fields, "failures": failures}


def run_d1_source_fidelity() -> Dict[str, Any]:
    # a) MITRE: always check the file hash, and compare content against the official STIX.
    subset_bytes = MITRE_SUBSET_PATH.read_bytes()
    subset_sha = hashlib.sha256(subset_bytes).hexdigest()
    subset = json.loads(subset_bytes.decode("utf-8"))
    mitre_bytes = _fetch_or_cache(MITRE_URL, "enterprise-attack-19.2.json")
    if mitre_bytes:
        mitre = check_mitre_fidelity(subset, json.loads(mitre_bytes.decode("utf-8")).get("objects", []))
        mode = "compared against official STIX"
    else:
        mitre = {"passed": 0, "total": 0, "field_checks_passed": 0, "field_checks_total": 0,
                 "step_checks_passed": 0, "step_checks_total": 0,
                 "technique_count": len(subset.get("techniques", [])),
                 "failures": ["official STIX unavailable; content not compared"]}
        mode = "official STIX unavailable"
    if subset_sha != EXPECTED_MITRE_SHA256:
        mitre["failures"].append(f"subset SHA-256 {subset_sha} != provided original {EXPECTED_MITRE_SHA256}")
    mitre_check = _check(
        mitre["passed"], mitre["total"],
        field_passed=mitre["field_checks_passed"], field_total=mitre["field_checks_total"],
        step_passed=mitre["step_checks_passed"], step_total=mitre["step_checks_total"],
        sha256=subset_sha, sha256_expected=EXPECTED_MITRE_SHA256, sha256_ok=subset_sha == EXPECTED_MITRE_SHA256,
        failures=mitre["failures"],
        meaning=(
            f"Each of the {mitre['technique_count']} ATT&CK techniques is checked against the official STIX for ID and URL, "
            f"name, and mitigation / detection-strategy references (IDs, names, URLs) — {mitre['field_checks_passed']}/"
            f"{mitre['field_checks_total']} technique checks; every scenario step reference is checked for ID and name — "
            f"{mitre['step_checks_passed']}/{mitre['step_checks_total']} step checks. The file hash is checked against the provided original."
        ),
        evidence=f"MITRE Enterprise v{subset.get('source', {}).get('version', '?')} STIX (enterprise-attack-19.2.json); {mode}",
    )
    if mitre_check["failures"]:
        mitre_check["status"] = "FAIL"

    # b) CTID: compare every subset row with the official file.
    ctid_bytes_subset = CTID_SUBSET_PATH.read_bytes()
    ctid_sha = hashlib.sha256(ctid_bytes_subset).hexdigest()
    subset_rows = json.loads(ctid_bytes_subset.decode("utf-8")).get("mapping_objects", [])
    ctid_official = _fetch_or_cache(CTID_URL, "m365-07.18.2025_attack-16.1-enterprise.json")
    if ctid_official:
        ctid = check_ctid_fidelity(subset_rows, json.loads(ctid_official.decode("utf-8")).get("mapping_objects", []))
        mode = "compared against official CTID file"
    else:
        ctid = {"passed": 0, "total": len(subset_rows), "fields_compared": [], "failures": ["official CTID file unavailable; content not compared"]}
        mode = "official CTID file unavailable"
    if ctid_sha != EXPECTED_CTID_SHA256:
        ctid["failures"].append(f"subset SHA-256 {ctid_sha} != provided original {EXPECTED_CTID_SHA256}")
    ctid_check = _check(
        ctid["passed"], ctid["total"],
        fields_compared=ctid["fields_compared"], sha256=ctid_sha, sha256_ok=ctid_sha == EXPECTED_CTID_SHA256,
        failures=ctid["failures"],
        meaning=(
            f"{ctid['passed']} of {ctid['total']} Microsoft 365 mapping rows appear identically in the official CTID Mappings "
            f"Explorer file (compared on {len(ctid['fields_compared'])} fields); the file hash is checked against the provided original."
        ),
        evidence=f"CTID Mappings Explorer M365 07/18/2025 (ATT&CK v16.1); {mode}",
    )
    if ctid_check["failures"]:
        ctid_check["status"] = "FAIL"

    # c) Published figures: the derivation and the values used by the model.
    s3 = data_loader.current_assumptions.scenarios["S3"].loss_per_success
    s4 = data_loader.current_assumptions.scenarios["S4"].loss_per_success
    ic3_derived = round(IC3_BEC_LOSSES / IC3_BEC_COMPLAINTS)
    figures = [
        {
            "name": "FBI IC3 2025 — average loss per business email compromise complaint",
            "derivation": f"${IC3_BEC_LOSSES:,} ÷ {IC3_BEC_COMPLAINTS:,} = ${IC3_BEC_LOSSES / IC3_BEC_COMPLAINTS:,.2f} → ${ic3_derived:,}",
            "model_value": s3.likely,
            "source_label": s3.source.label if s3.source else None,
            "ok": s3.likely == ic3_derived and bool(s3.source) and s3.source.type == "published_figure",
        },
        {
            "name": "Sophos State of Ransomware 2026 — mean recovery cost excluding ransom",
            "derivation": "value as published",
            "model_value": s4.likely,
            "source_label": s4.source.label if s4.source else None,
            "ok": bool(s4.source) and s4.source.type == "published_figure" and f"${s4.likely:,.0f}" in (s4.source.label or ""),
        },
    ]
    pub_passed = sum(1 for f in figures if f["ok"])
    published = _check(
        pub_passed, len(figures), figures=figures,
        meaning=f"{pub_passed} of {len(figures)} published loss figures used by the model reproduce their cited values.",
        evidence="risk_assumptions.json source labels; FBI IC3 2025 Internet Crime Report; Sophos State of Ransomware 2026",
    )

    return {"mitre_fidelity": mitre_check, "ctid_fidelity": ctid_check, "published_figures": published}


# ---------------------------------------------------------------------------------------------
# D2. Completeness and validity
# ---------------------------------------------------------------------------------------------

def run_d2_completeness_validity() -> Dict[str, Any]:
    data = REPO_ROOT / "backend" / "data"
    schema_files = [
        ("MITRE_ATTACK_demo_subset.json", data / "mitre/MITRE_ATTACK_demo_subset.json", MitreAttackDataset),
        ("tools.json", data / "tools.json", TypeAdapter(List[Tool])),
        ("mappings.json", data / "mappings.json", TypeAdapter(List[MappingEvidence])),
        ("risk_assumptions.json", data / "risk_assumptions.json", RiskAssumptions),
        ("scenario_overrides.json", data / "scenario_overrides.json", TypeAdapter(Dict[str, ScenarioOverride])),
        ("normal_day.json", data / "normal_day.json", NormalDayDataset),
        ("ctid_m365_mappings_subset.json", data / "ctid/ctid_m365_mappings_subset.json", CTIDSubsetFile),
    ]
    schema_failures: List[str] = []
    for name, path, model in schema_files:
        try:
            content = json.loads(path.read_text(encoding="utf-8"))
            if hasattr(model, "validate_python"):
                model.validate_python(content)
            else:
                model(**content)
        except Exception as exc:  # noqa: BLE001 — any failure is a validation failure
            schema_failures.append(f"{name}: {exc.__class__.__name__}")

    ref_checks: List[Tuple[str, bool]] = []
    for m in data_loader.mappings:
        ref_checks.append((f"mapping technique {m.technique_id}", m.technique_id in data_loader.techniques))
        ref_checks.append((f"mapping tool {m.tool_id}", m.tool_id in data_loader.tools))
    for sc in data_loader.scenarios.values():
        ref_checks.append((f"assumptions for {sc.id}", sc.id in data_loader.current_assumptions.scenarios))
        for st in sc.steps:
            ref_checks.append((f"{sc.id} step {st.order} technique {st.technique_id}", st.technique_id in data_loader.techniques))
            for alt in st.alternative_techniques:
                ref_checks.append((f"{sc.id} step {st.order} alternative {alt.id}", alt.id in data_loader.techniques))

    comp_checks: List[Tuple[str, bool]] = []
    for sc in data_loader.scenarios.values():
        for st in sc.steps:
            tech = data_loader.techniques.get(st.technique_id)
            comp_checks.append((f"{sc.id} step {st.order}", bool(st.step and st.technique_name and tech and tech.url)))
    for tid, tech in data_loader.techniques.items():
        comp_checks.append((f"technique {tid}", bool(tech.description and tech.url)))

    n_files = len(schema_files)
    ref_ok = sum(ok for _, ok in ref_checks)
    comp_ok = sum(ok for _, ok in comp_checks)
    return {
        "schema_validity": _check(
            n_files - len(schema_failures), n_files, failures=schema_failures,
            meaning=f"{n_files - len(schema_failures)} of {n_files} data files validate against their strict Pydantic schemas.",
            evidence="Pydantic v2 validation of backend/data JSON files",
        ),
        "referential_integrity": _check(
            ref_ok, len(ref_checks), failures=[n for n, ok in ref_checks if not ok],
            meaning=f"{ref_ok} of {len(ref_checks)} cross-references (mapping techniques and tools, scenario assumptions, step and alternative techniques) resolve.",
            evidence="cross-checks across backend data files",
        ),
        "completeness": _check(
            comp_ok, len(comp_checks), failures=[n for n, ok in comp_checks if not ok],
            meaning=f"{comp_ok} of {len(comp_checks)} scenario steps and techniques have their text, names and links.",
            evidence="step narrative and technique metadata checks",
        ),
    }


# ---------------------------------------------------------------------------------------------
# D3. Traceability
# ---------------------------------------------------------------------------------------------

def _model_inputs() -> List[Dict[str, Any]]:
    """The 11 key model inputs: 3 step pass probabilities + attempts and loss for each scenario."""
    a = data_loader.current_assumptions
    rows: List[Dict[str, Any]] = []
    for outcome in ("stopped", "detected", "missed"):
        src = a.step_pass_probability.source
        rows.append({"input": f"pass.{outcome}", "type": src.type if src else None, "label": src.label if src else None})
    for sc_id, sc in a.scenarios.items():
        for field, short in (("attempts_per_year", "attempts"), ("loss_per_success", "loss")):
            src = getattr(sc, field).source
            rows.append({"input": f"{sc_id}.{short}", "type": src.type if src else None, "label": src.label if src else None})
    return rows


def run_d3_traceability() -> Dict[str, Any]:
    mappings = data_loader.mappings
    total = len(mappings)
    counts = {t: sum(1 for m in mappings if m.evidence_type == t) for t in ALL_EVIDENCE_TYPES}
    official = sum(counts[t] for t in OFFICIAL_EVIDENCE_TYPES)
    labelled = sum(1 for m in mappings if m.evidence_type in ALL_EVIDENCE_TYPES and EVIDENCE_LABELS.get(m.evidence_type))
    downgrades = data_loader.evidence_report.downgrades
    breakdown = [
        {"type": t, "count": counts[t], "share": f"{_pct(counts[t], total):.1f}%", "official": t in OFFICIAL_EVIDENCE_TYPES}
        for t in ALL_EVIDENCE_TYPES
    ]
    ctid_support = sum(1 for m in mappings if m.ctid_support)

    inputs = _model_inputs()
    n_inputs = len(inputs)
    by_type: Dict[str, int] = {}
    for row in inputs:
        by_type[row["type"] or "unlabelled"] = by_type.get(row["type"] or "unlabelled", 0) + 1
    input_labels_ok = sum(1 for r in inputs if r["type"] and r["label"])

    return {
        # Pass/fail: every mapping carries a known evidence type and a visible label.
        "mapping_evidence_labels": _check(
            labelled, total, downgrades_count=len(downgrades),
            meaning=f"{labelled} of {total} tool-to-technique mappings carry an evidence type and a visible evidence label.",
            evidence="backend/data/mappings.json via data_loader",
        ),
        # Informational share (not a pass/fail criterion).
        "mappings_backed_by_official_sources": {
            "passed": official, "total": total, "pct": _pct(official, total), "status": "INFO",
            "breakdown": breakdown, "downgrades_count": len(downgrades), "ctid_support_count": ctid_support,
            "meaning": f"{official} of {total} mappings ({_pct(official, total):.1f}%) are backed by MITRE or CTID; the rest are labelled as team assumptions or vendor descriptions.",
            "evidence": "evidence_type field of backend/data/mappings.json",
        },
        "model_inputs_from_published_figures": {
            "passed": by_type.get("published_figure", 0), "total": n_inputs,
            "pct": _pct(by_type.get("published_figure", 0), n_inputs), "status": "INFO",
            "breakdown": {t: {"count": c, "pct": _pct(c, n_inputs)} for t, c in sorted(by_type.items())},
            "inputs": inputs,
            "meaning": "Published figures are used where public data exists; the other inputs are labelled, editable assumptions.",
            "evidence": "source.type of each input in backend/data/risk_assumptions.json",
        },
        "ui_source_labels": _check(
            input_labels_ok, n_inputs,
            meaning=f"{input_labels_ok} of {n_inputs} model inputs shown in the Assumptions drawer carry a source type and label.",
            evidence="source fields in backend/data/risk_assumptions.json",
        ),
    }


# ---------------------------------------------------------------------------------------------
# D4. Correctness and reproducibility
# ---------------------------------------------------------------------------------------------

def all_tool_configs() -> List[List[str]]:
    """All 2^n combinations of the tools in tools.json, in a fixed order."""
    ids = list(data_loader.tools.keys())
    return [[t for i, t in enumerate(ids) if mask >> i & 1] for mask in range(2 ** len(ids))]


def python_engine_results(configs: List[List[str]]) -> List[Dict[str, Any]]:
    a = _point_assumptions()
    out = []
    for cfg in configs:
        sim = _simulate(cfg, a)
        out.append({
            "active_tool_ids": cfg,
            "total_ale_point_rounded": sim.total_ale_point_rounded,
            "scenarios": {
                sid: {
                    "ale_point_rounded": sc.ale_point_rounded,
                    "risk_score_display": sc.risk_score_display,
                    "severity": sc.severity,
                    "outcomes": [st.outcome for st in sc.steps],
                }
                for sid, sc in sim.scenarios.items()
            },
        })
    return out


def compare_engines(py: List[Dict[str, Any]], ts: List[Dict[str, Any]]) -> Dict[str, Any]:
    ts_by_cfg = {tuple(sorted(r["active_tool_ids"])): r for r in ts}
    failures: List[str] = []
    passed = 0
    for r in py:
        cfg = tuple(sorted(r["active_tool_ids"]))
        other = ts_by_cfg.get(cfg)
        if other is None:
            failures.append(f"[{', '.join(cfg)}]: missing from TypeScript results")
            continue
        diffs = []
        if other["total_ale_point_rounded"] != r["total_ale_point_rounded"]:
            diffs.append(f"total {r['total_ale_point_rounded']} vs {other['total_ale_point_rounded']}")
        for sid, sc in r["scenarios"].items():
            o = other["scenarios"].get(sid, {})
            for field in ("ale_point_rounded", "risk_score_display", "severity", "outcomes"):
                if o.get(field) != sc[field]:
                    diffs.append(f"{sid}.{field} {sc[field]} vs {o.get(field)}")
        if diffs:
            failures.append(f"[{', '.join(cfg)}]: " + "; ".join(diffs[:4]))
        else:
            passed += 1
    return {"passed": passed, "total": len(py), "failures": failures[:20], "failure_count": len(failures)}


def scan_banned_phrases() -> List[Dict[str, Any]]:
    """Scan code and user-facing copy. Skips the phrase list itself, the generated data (MITRE/CTID
    source text) and test files, which have to name the phrases in order to check for them."""
    skip_names = {"summary.py", "validation.py", "test_api.py", "generated.json", "generated.meta.json", "parity.json"}
    hits: List[Dict[str, Any]] = []
    for root in (REPO_ROOT / "backend" / "app", REPO_ROOT / "frontend" / "src"):
        for f in sorted(root.rglob("*")):
            if not f.is_file() or f.suffix not in (".py", ".ts", ".tsx", ".json", ".md") or f.name in skip_names:
                continue
            for lineno, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                low = line.lower()
                for bp in BANNED_PHRASES:
                    found = re.search(r"\bsecure\b", low) if bp == "secure" else (bp in low)
                    if found:
                        hits.append({"file": str(f.relative_to(REPO_ROOT)), "line": lineno, "phrase_index": BANNED_PHRASES.index(bp)})
    return hits


def run_d4_correctness_reproducibility(
    test_results: Optional[Dict[str, Any]] = None,
    ts_engine: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    # 1. Acceptance tests — counts come from the pytest and vitest JSON reporters (scripts/validate.py).
    if test_results:
        suites = {k: v for k, v in test_results.items()}
        passed = sum(s["passed"] for s in suites.values())
        total = sum(s["total"] for s in suites.values())
        acceptance = _check(
            passed, total, suites=suites,
            meaning=f"{passed} of {total} automated tests passed (" + ", ".join(f"{k}: {v['passed']}/{v['total']}" for k, v in suites.items()) + ").",
            evidence="pytest-json-report and vitest --reporter=json output",
        )
        if any(s.get("failed", 0) or s.get("errors", 0) for s in suites.values()):
            acceptance["status"] = "FAIL"
    else:
        acceptance = _not_run("Test suites were not run (run scripts/validate.py).")

    # 2. Python–TypeScript parity — both engines are actually run over every tool combination.
    configs = all_tool_configs()
    if ts_engine and ts_engine.get("results") is not None:
        cmp = compare_engines(python_engine_results(configs), ts_engine["results"])
        parity = _check(
            cmp["passed"], cmp["total"], failures=cmp["failures"], failure_count=cmp["failure_count"],
            meaning=(
                f"{cmp['passed']} of {cmp['total']} tool combinations give identical rounded ALE, risk score, severity and step "
                f"outcomes in the Python and TypeScript engines."
            ),
            evidence="Python engine vs frontend/scripts/engine-dump.mjs (TypeScript engine), all 2^n combinations",
        )
    else:
        parity = _not_run("TypeScript engine was not run (run scripts/validate.py).", total_configs=len(configs))

    # 3. Determinism: two runs give identical numbers (point ALE and seeded Monte Carlo percentiles).
    a = data_loader.current_assumptions
    sim1, sim2 = _simulate(BASELINE_TOOLS, a), _simulate(BASELINE_TOOLS, a)
    det = [
        sim1.total_ale_point_rounded == sim2.total_ale_point_rounded,
        sim1.total_ale_range.p10 == sim2.total_ale_range.p10 and sim1.total_ale_range.p90 == sim2.total_ale_range.p90,
    ]
    determinism = _check(
        sum(det), len(det),
        meaning=f"Repeated runs give identical point ALE and Monte Carlo percentiles (seed {a.monte_carlo.seed}, {a.monte_carlo.iterations:,} iterations).",
        evidence="double run of the baseline simulation",
    )

    # 4. Copy compliance — PASS only with zero violations.
    hits = scan_banned_phrases()
    compliance = {
        "passed": 1 if not hits else 0, "total": 1, "pct": 100.0 if not hits else 0.0,
        "status": "PASS" if not hits else "FAIL",
        "violations_count": len(hits), "violations": hits,
        "meaning": (
            "No absolute security or guarantee claims were found in code or user-facing copy."
            if not hits else
            f"{len(hits)} occurrence(s) of a banned phrase found in code or user-facing copy; see violations."
        ),
        "evidence": f"scan of backend/app and frontend/src against {len(BANNED_PHRASES)} banned phrases",
    }

    return {"acceptance_tests": acceptance, "python_ts_parity": parity, "determinism": determinism, "copy_compliance": compliance}


# ---------------------------------------------------------------------------------------------
# D5. Decision robustness
# ---------------------------------------------------------------------------------------------

SENSITIVITY_INPUTS = [
    ("pass.stopped", ("step_pass_probability", "stopped"), "Stopped step pass probability"),
    ("pass.detected", ("step_pass_probability", "detected"), "Detected step pass probability"),
    ("pass.missed", ("step_pass_probability", "missed"), "Missed step pass probability"),
] + [
    (f"{sc}.{short}", ("scenarios", sc, field, "likely"), f"{sc} {label}")
    for sc in ("S1", "S2", "S3", "S4")
    for short, field, label in (("attempts", "attempts_per_year", "attempts/year"), ("loss", "loss_per_success", "loss/success"))
]


def _perturb(a: RiskAssumptions, path: Tuple[str, ...], mult: float) -> None:
    target: Any = a
    for p in path[:-1]:
        target = getattr(target, p) if hasattr(target, p) else target[p]
    field = path[-1]
    new_val = (getattr(target, field) if hasattr(target, field) else target[field]) * mult
    if path[0] == "step_pass_probability":
        new_val = min(1.0, new_val)
    if hasattr(target, field):
        setattr(target, field, new_val)
    else:
        target[field] = new_val


def run_d5_decision_robustness() -> Dict[str, Any]:
    ref_plan = sorted(_optimize(_point_assumptions()).recommended_tools)
    labels = {sid: sc.name for sid, sc in data_loader.scenarios.items()}

    def evaluate(a: RiskAssumptions) -> Tuple[int, bool, bool]:
        sim = _simulate(BASELINE_TOOLS, a)
        plan = _optimize(a)
        tx = next(t for t in sim.tool_returns if t.id == "tool_x")
        return sim.total_ale_point_rounded, sorted(plan.recommended_tools) == ref_plan, tx.classification == "low_return"

    oat_plan = oat_tx = oat_runs = 0
    tornado = []
    for name, path, label in SENSITIVITY_INPUTS:
        ales = {}
        for mult in OAT_MULTIPLIERS:
            a = _point_assumptions()
            _perturb(a, path, mult)
            ale, plan_same, tx_low = evaluate(a)
            oat_runs += 1
            oat_plan += plan_same
            oat_tx += tx_low
            ales[mult] = ale
        lo, hi = OAT_MULTIPLIERS
        sc_id = name.split(".")[0]
        tornado.append({
            "param": name,
            "label": label if not sc_id.startswith("S") else f"{sc_id} ({labels.get(sc_id, sc_id)}) {label.split(' ', 1)[1]}",
            "low_mult": lo, "low_ale": ales[lo], "high_mult": hi, "high_ale": ales[hi],
            "swing": abs(ales[hi] - ales[lo]),
        })
    tornado.sort(key=lambda x: x["swing"], reverse=True)

    rng = random.Random(JOINT_SEED)  # same stream as random.seed(JOINT_SEED)
    joint_plan = joint_tx = 0
    for _ in range(JOINT_RUNS):
        a = _point_assumptions()
        for name, path, label in SENSITIVITY_INPUTS:
            _perturb(a, path, rng.uniform(*JOINT_RANGE))
        _, plan_same, tx_low = evaluate(a)
        joint_plan += plan_same
        joint_tx += tx_low

    half_width = round((JOINT_RANGE[1] - JOINT_RANGE[0]) / 2 * 100)
    oat = _check(
        min(oat_plan, oat_tx), oat_runs,
        total_runs=oat_runs, plan_unchanged=oat_plan, plan_unchanged_pct=_pct(oat_plan, oat_runs),
        tool_x_low_return=oat_tx, tool_x_low_return_pct=_pct(oat_tx, oat_runs),
        multipliers=list(OAT_MULTIPLIERS), inputs=len(SENSITIVITY_INPUTS),
        meaning=f"Each of the {len(SENSITIVITY_INPUTS)} inputs is multiplied by {OAT_MULTIPLIERS[0]} and {OAT_MULTIPLIERS[1]} one at a time (probabilities capped at 1.0); plan unchanged in {oat_plan}/{oat_runs}, Tool X low return in {oat_tx}/{oat_runs}.",
        evidence=f"{oat_runs} one-at-a-time simulation and optimizer runs",
    )
    joint = _check(
        min(joint_plan, joint_tx), JOINT_RUNS,
        total_runs=JOINT_RUNS, plan_unchanged=joint_plan, plan_unchanged_pct=_pct(joint_plan, JOINT_RUNS),
        tool_x_low_return=joint_tx, tool_x_low_return_pct=_pct(joint_tx, JOINT_RUNS),
        range=list(JOINT_RANGE), half_width_pct=half_width, seed=JOINT_SEED,
        meaning=f"All {len(SENSITIVITY_INPUTS)} inputs multiplied together by Uniform({JOINT_RANGE[0]}, {JOINT_RANGE[1]}) (±{half_width}%), seed {JOINT_SEED}; plan unchanged in {joint_plan}/{JOINT_RUNS}, Tool X low return in {joint_tx}/{JOINT_RUNS}.",
        evidence=f"{JOINT_RUNS}-run joint perturbation",
    )
    if oat["status"] == "PASS" and joint["status"] == "PASS":
        conclusion = f"Even if every assumption is off by up to ±{half_width}%, the recommended plan and the Tool X finding do not change in the tested runs."
    else:
        conclusion = f"The recommended plan or the Tool X finding changed in some runs (one-at-a-time {oat_plan}/{oat_runs}, joint {joint_plan}/{JOINT_RUNS})."
    return {"reference_plan": ref_plan, "one_at_a_time": oat, "joint_perturbation": joint, "tornado": tornado, "conclusion": conclusion}


# ---------------------------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------------------------

def _combine(*checks: Dict[str, Any]) -> str:
    statuses = [c["status"] for c in checks if c.get("status") != "INFO"]
    if any(s == "FAIL" for s in statuses):
        return "FAIL"
    if any(s == "NOT_RUN" for s in statuses):
        return "NOT_RUN"
    return "PASS"


def _frac(c: Dict[str, Any]) -> str:
    return f"{c['passed']}/{c['total']} ({c['pct']:.0f}%)" if c.get("status") != "NOT_RUN" else "not run"


def generate_full_validation_report(
    test_results: Optional[Dict[str, Any]] = None,
    ts_engine: Optional[Dict[str, Any]] = None,
    extra_checks: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    data_loader.reset_assumptions()

    framing = (
        "This project has no historical incident data for the fictional company, so predictive accuracy "
        "cannot be measured. Following data-quality best practice (dimensions used by ISO/IEC 25012 and "
        "DAMA-DMBOK), we measure (1) how faithfully our data reproduces its official sources, "
        "(2) completeness, validity and consistency, (3) traceability of every number, "
        "(4) correctness and reproducibility of the calculation engine, and (5) how stable the "
        "recommendations are when assumptions change."
    )

    d1 = run_d1_source_fidelity()
    d2 = run_d2_completeness_validity()
    d3 = run_d3_traceability()
    d4 = run_d4_correctness_reproducibility(test_results, ts_engine)
    d4.update(extra_checks or {})
    d5 = run_d5_decision_robustness()

    official = d3["mappings_backed_by_official_sources"]
    published = d3["model_inputs_from_published_figures"]
    scorecard = [
        {
            "dimension": "Accuracy vs. source",
            "metric": "MITRE fidelity / CTID fidelity / published figures",
            "result": f"{_frac(d1['mitre_fidelity'])} / {_frac(d1['ctid_fidelity'])} / {_frac(d1['published_figures'])}",
            "status": _combine(d1["mitre_fidelity"], d1["ctid_fidelity"], d1["published_figures"]),
        },
        {
            "dimension": "Completeness & validity",
            "metric": "schema validity / referential integrity / completeness",
            "result": f"{_frac(d2['schema_validity'])} / {_frac(d2['referential_integrity'])} / {_frac(d2['completeness'])}",
            "status": _combine(*d2.values()),
        },
        {
            "dimension": "Traceability",
            "metric": "mappings with evidence labels / inputs with source labels (backed by official sources; from published figures)",
            "result": (
                f"{_frac(d3['mapping_evidence_labels'])} / {_frac(d3['ui_source_labels'])} "
                f"({official['pct']:.1f}% = {official['passed']}/{official['total']}; {published['pct']:.1f}% = {published['passed']}/{published['total']})"
            ),
            "status": _combine(*d3.values()),
        },
        {
            "dimension": "Correctness",
            "metric": "automated tests (pytest + vitest) / Python–TS parity" + (" / Monte Carlo range agreement" if "monte_carlo_agreement" in d4 else ""),
            "result": " / ".join(
                [_frac(d4["acceptance_tests"]), _frac(d4["python_ts_parity"])]
                + ([_frac(d4["monte_carlo_agreement"])] if "monte_carlo_agreement" in d4 else [])
            ),
            "status": _combine(d4["acceptance_tests"], d4["python_ts_parity"], *([d4["monte_carlo_agreement"]] if "monte_carlo_agreement" in d4 else [])),
        },
        {
            "dimension": "Reproducibility",
            "metric": "determinism checks (simulation & Monte Carlo)",
            "result": _frac(d4["determinism"]),
            "status": d4["determinism"]["status"],
        },
        {
            "dimension": "Robustness",
            "metric": f"plan and Tool X finding unchanged under ±{d5['joint_perturbation']['half_width_pct']}% (one-at-a-time / joint)",
            "result": f"{_frac(d5['one_at_a_time'])} / {_frac(d5['joint_perturbation'])}",
            "status": _combine(d5["one_at_a_time"], d5["joint_perturbation"]),
        },
        {
            "dimension": "Compliance",
            "metric": "banned-phrase violations",
            "result": f"{d4['copy_compliance']['violations_count']} violations",
            "status": d4["copy_compliance"]["status"],
        },
    ]

    ctid_techniques = {row.get("attack_object_id") for row in json.loads(CTID_SUBSET_PATH.read_text(encoding="utf-8")).get("mapping_objects", [])}
    subset_techniques = sorted(data_loader.techniques)
    no_ctid = [t for t in subset_techniques if t not in ctid_techniques]
    limitations = [
        "No predictive validation is possible without real incident data for the fictional company.",
        f"CTID mappings use ATT&CK v16.1 while the scenarios use v{data_loader.mitre_source.version}; "
        f"{len(no_ctid)} of {len(subset_techniques)} techniques have no CTID Microsoft 365 row ({', '.join(no_ctid) or 'none'}).",
        "Published loss figures are averages across organizations of all sizes; a few very large losses pull the mean up.",
        "Tool costs and attack frequencies are sample assumptions (labelled in the app and editable in the Assumptions drawer).",
    ]

    return {
        "title": "ROI Cyber-Validator Data Validation Report",
        "framing": framing,
        "all_passed": all(row["status"] == "PASS" for row in scorecard),
        "scorecard": scorecard,
        "d1_source_fidelity": d1,
        "d2_completeness_validity": d2,
        "d3_traceability": d3,
        "d4_correctness_reproducibility": d4,
        "d5_decision_robustness": d5,
        "limitations": limitations,
    }

#!/usr/bin/env python3
"""Run the full validation and write validation_report.json + VALIDATION_REPORT.md.

Steps (all results are computed, nothing is typed in):
  1. regenerate backend/tests/fixtures/parity.json from the Python engine (all tool combinations);
  2. run pytest and vitest with their JSON reporters and read the real counts;
  3. run the TypeScript engine (frontend/scripts/engine-dump.mjs) over the same combinations;
  4. build the report (backend/app/validation.py) and render the Markdown from the JSON only.

Exit status is 0 only when every scorecard row is PASS.

Usage (from repo root):  backend/.venv/bin/python scripts/validate.py
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND = REPO_ROOT / "backend"
FRONTEND = REPO_ROOT / "frontend"
sys.path.insert(0, str(BACKEND))

from app.validation import (  # noqa: E402
    BASELINE_TOOLS,
    all_tool_configs,
    generate_full_validation_report,
    python_engine_results,
    python_monte_carlo_reference,
)

PARITY_FIXTURE = BACKEND / "tests" / "fixtures" / "parity.json"
MC_FIXTURE = BACKEND / "tests" / "fixtures" / "monte_carlo_reference.json"
JSON_PATH = REPO_ROOT / "validation_report.json"
MD_PATH = REPO_ROOT / "VALIDATION_REPORT.md"
MC_TOLERANCE = 0.03  # TS P10/P90 must be within ±3% of Python (different random generators)


def log(msg: str) -> None:
    print(f"[validate.py] {msg}", flush=True)


def write_fixtures() -> None:
    """Python reference outputs consumed by vitest (tests/test_fixture_freshness.py checks they are current)."""
    results = python_engine_results(all_tool_configs())
    PARITY_FIXTURE.write_text(json.dumps(results, indent=1) + "\n", encoding="utf-8")
    log(f"Wrote {len(results)} Python engine results to {PARITY_FIXTURE.relative_to(REPO_ROOT)}")
    MC_FIXTURE.write_text(json.dumps(python_monte_carlo_reference(), indent=1) + "\n", encoding="utf-8")
    log(f"Wrote Python Monte Carlo reference to {MC_FIXTURE.relative_to(REPO_ROOT)}")


def run_pytest() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "pytest.json"
        cmd = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider",
               "--json-report", f"--json-report-file={out}", "--json-report-omit", "collectors", "log", "streams"]
        proc = subprocess.run(cmd, cwd=BACKEND, env={**os.environ, "PYTHONPATH": "."}, capture_output=True, text=True)
        if not out.exists():
            raise SystemExit(f"pytest produced no JSON report (exit {proc.returncode}):\n{proc.stdout}\n{proc.stderr}")
        summary = json.loads(out.read_text())["summary"]
    res = {
        "passed": summary.get("passed", 0), "failed": summary.get("failed", 0), "errors": summary.get("error", 0),
        "skipped": summary.get("skipped", 0), "total": summary.get("total", 0), "exit_code": proc.returncode,
    }
    log(f"pytest: {res}")
    return res


def run_vitest() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "vitest.json"
        cmd = ["npx", "vitest", "run", "--reporter=json", f"--outputFile={out}"]
        proc = subprocess.run(cmd, cwd=FRONTEND, capture_output=True, text=True)
        if not out.exists():
            raise SystemExit(f"vitest produced no JSON report (exit {proc.returncode}):\n{proc.stdout}\n{proc.stderr}")
        report = json.loads(out.read_text())
    res = {
        "passed": report.get("numPassedTests", 0), "failed": report.get("numFailedTests", 0), "errors": 0,
        "skipped": report.get("numPendingTests", 0) + report.get("numTodoTests", 0),
        "total": report.get("numTotalTests", 0), "exit_code": proc.returncode,
    }
    log(f"vitest: {res}")
    return res


def run_ts_engine(configs: list) -> dict:
    request = json.dumps({"configs": configs, "range_tools": BASELINE_TOOLS})
    proc = subprocess.run(["node", "scripts/engine-dump.mjs"], cwd=FRONTEND, input=request, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"TypeScript engine failed (exit {proc.returncode}):\n{proc.stderr}")
    data = json.loads(proc.stdout)
    log(f"TypeScript engine: {len(data['results'])} configurations")
    return data


def monte_carlo_agreement(ts_range: dict) -> dict:
    """TS and Python use different random generators, so ranges are compared within a tolerance."""
    py = python_monte_carlo_reference()
    rows = []
    for q in ("p10", "p90"):
        rel = abs(ts_range[q] - py[q]) / py[q]
        rows.append({"percentile": q, "python": round(py[q]), "typescript": round(ts_range[q]),
                     "relative_difference_pct": rel * 100, "ok": rel <= MC_TOLERANCE})
    passed = sum(r["ok"] for r in rows)
    same_iterations = ts_range.get("iterations") == py["iterations"]
    return {
        "passed": passed, "total": len(rows), "pct": passed / len(rows) * 100,
        "status": "PASS" if passed == len(rows) and same_iterations else "FAIL",
        "tolerance_pct": MC_TOLERANCE * 100, "rows": rows,
        "python_iterations": py["iterations"], "typescript_iterations": ts_range.get("iterations"),
        "meaning": (
            f"Baseline P10 and P90 from the TypeScript engine are within ±{MC_TOLERANCE * 100:.0f}% of the Python engine "
            f"({', '.join(f"{r['percentile'].upper()} {r['relative_difference_pct']:.2f}%" for r in rows)}; "
            f"{py['iterations']:,} iterations each). The two engines use different random number generators, so the ranges "
            "are close but not identical."
        ),
        "evidence": "Python risk.run_monte_carlo vs frontend/scripts/engine-dump.mjs, baseline tools",
    }


# ------------------------------------------------------------------ Markdown (rendered from JSON only)

def _fails(check: dict, lines: list) -> None:
    for f in check.get("failures") or []:
        lines.append(f"  - ✗ {f}")


def _item(title: str, check: dict, lines: list) -> None:
    head = f"{check['passed']} / {check['total']} ({check['pct']:.1f}%)" if check.get("status") != "NOT_RUN" else "not run"
    lines.append(f"- **{title}:** {head} — **{check['status']}**")
    lines.append(f"  - {check['meaning']}")
    lines.append(f"  - Evidence: {check['evidence']}")
    _fails(check, lines)


def render_markdown(r: dict) -> str:
    L = [f"# {r['title']}", "", f"> {r['framing']}", ""]
    L += [f"**Overall: {'PASS' if r['all_passed'] else 'FAIL'}**", "", "## Executive Scorecard", "",
          "| Dimension | Metric | Result | Status |", "|---|---|---|---|"]
    L += [f"| {s['dimension']} | {s['metric']} | **{s['result']}** | {s['status']} |" for s in r["scorecard"]]

    d1 = r["d1_source_fidelity"]
    L += ["", "## D1. Source Fidelity", ""]
    _item("MITRE ATT&CK fidelity", d1["mitre_fidelity"], L)
    m = d1["mitre_fidelity"]
    L.append(f"  - Technique checks {m['field_passed']}/{m['field_total']}; step reference checks {m['step_passed']}/{m['step_total']}; "
             f"SHA-256 `{m['sha256']}` ({'matches' if m['sha256_ok'] else 'does NOT match'} the provided original)")
    _item("CTID M365 mapping fidelity", d1["ctid_fidelity"], L)
    _item("Published loss figures", d1["published_figures"], L)
    for f in d1["published_figures"]["figures"]:
        L.append(f"  - {'✓' if f['ok'] else '✗'} {f['name']}: {f['derivation']}; model value ${f['model_value']:,.0f}")

    L += ["", "## D2. Completeness and Validity", ""]
    for key, title in (("schema_validity", "Schema validity"), ("referential_integrity", "Referential integrity"), ("completeness", "Completeness")):
        _item(title, r["d2_completeness_validity"][key], L)

    d3 = r["d3_traceability"]
    off = d3["mappings_backed_by_official_sources"]
    L += ["", "## D3. Traceability", ""]
    _item("Mappings with evidence labels", d3["mapping_evidence_labels"], L)
    L += ["", f"### Tool → technique mappings ({off['total']})", "", "| Evidence type | Count | Share | Official source |", "|---|---|---|---|"]
    L += [f"| `{b['type']}` | {b['count']} | {b['share']} | {'Yes' if b['official'] else 'No'} |" for b in off["breakdown"]]
    L += ["", f"- Backed by official sources: {off['passed']} / {off['total']} = **{off['pct']:.1f}%**; "
          f"mappings with CTID support: {off['ctid_support_count']}; runtime downgrades: {off['downgrades_count']}."]
    mi = d3["model_inputs_from_published_figures"]
    L += ["", f"### Risk-model inputs ({mi['total']})", ""]
    L += [f"- `{t}`: {v['count']} / {mi['total']} ({v['pct']:.1f}%)" for t, v in mi["breakdown"].items()]
    _item("Inputs with source labels", d3["ui_source_labels"], L)

    d4 = r["d4_correctness_reproducibility"]
    L += ["", "## D4. Engine Correctness and Reproducibility", ""]
    _item("Automated tests", d4["acceptance_tests"], L)
    for name, s in (d4["acceptance_tests"].get("suites") or {}).items():
        L.append(f"  - {name}: {s['passed']} passed, {s['failed']} failed, {s['errors']} errors, {s['skipped']} skipped (of {s['total']})")
    _item("Python–TypeScript parity", d4["python_ts_parity"], L)
    if "monte_carlo_agreement" in d4:
        mc = d4["monte_carlo_agreement"]
        _item("Monte Carlo range agreement", mc, L)
        L.append(f"  - Iterations: Python {mc['python_iterations']:,}, TypeScript {mc['typescript_iterations']:,}")
        for row in mc["rows"]:
            L.append(f"  - {row['percentile'].upper()}: Python ${row['python']:,} vs TypeScript ${row['typescript']:,} "
                     f"({row['relative_difference_pct']:.2f}%, tolerance ±{mc['tolerance_pct']:.0f}%)")
    _item("Determinism", d4["determinism"], L)
    cc = d4["copy_compliance"]
    L.append(f"- **Copy compliance:** {cc['violations_count']} violations — **{cc['status']}**")
    L.append(f"  - {cc['meaning']}")
    L += [f"  - ✗ {v['file']}:{v['line']}" for v in cc["violations"]]

    d5 = r["d5_decision_robustness"]
    L += ["", "## D5. Decision Robustness (Sensitivity Analysis)", "",
          f"Reference plan: {', '.join(d5['reference_plan'])}", ""]
    _item("One-at-a-time", d5["one_at_a_time"], L)
    _item("Joint random perturbation", d5["joint_perturbation"], L)
    L += ["", f"> **Plain-language conclusion:** {d5['conclusion']}", "",
          "### Tornado table (inputs ranked by impact on baseline total ALE)", "",
          "| Rank | Input | Description | Low ALE | High ALE | Swing |", "|---|---|---|---|---|---|"]
    L += [f"| {i} | `{t['param']}` | {t['label']} | ×{t['low_mult']}: ${t['low_ale']:,} | ×{t['high_mult']}: ${t['high_ale']:,} | **${t['swing']:,}** |"
          for i, t in enumerate(d5["tornado"], 1)]

    L += ["", "## Limitations", ""] + [f"- {x}" for x in r["limitations"]] + [""]
    return "\n".join(L)


def main() -> int:
    log("Running full validation...")
    write_fixtures()
    tests = {"pytest": run_pytest(), "vitest": run_vitest()}
    ts = run_ts_engine(all_tool_configs())
    mc = monte_carlo_agreement(ts["range"])
    report = generate_full_validation_report(test_results=tests, ts_engine=ts, extra_checks={"monte_carlo_agreement": mc})

    JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    MD_PATH.write_text(render_markdown(json.loads(JSON_PATH.read_text(encoding="utf-8"))), encoding="utf-8")
    log(f"Wrote {JSON_PATH.name} and {MD_PATH.name}")
    for row in report["scorecard"]:
        log(f"  {row['status']:<7} {row['dimension']}: {row['result']}")
    if not report["all_passed"]:
        log("FAIL: at least one check did not pass.")
        return 1
    log("PASS: every check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

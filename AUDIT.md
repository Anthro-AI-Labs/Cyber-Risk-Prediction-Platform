# AUDIT — ROI Cyber-Validator (2026-09-27, commit `0d7217c`, clean tree)

**Ground truth:** `docs/REFERENCE_FACTS.md`. It is a byte-identical copy of the previous root CLAUDE.md, SHA-256 `4be02119…`.

**Method:** every test, build and validation run was done in a scratch copy of the repo, so no repo file was modified by the audit.
- The backend was started from that copy on :8765.
- The frontend production build was served on :3100 with no backend on :8000.
- The official MITRE v19.2 STIX and CTID M365 files were downloaded fresh.
- The original data files were found in `~/Downloads/data_update_v3_1/`.

Raw outputs are in the appendix.

**Status legend:** OK = matches the reference · PROBLEM = does not match, or a claim is not backed by computation · UNVERIFIABLE = cannot be checked with the available material.

| # | Item | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| 1 | SHA-256 `MITRE_ATTACK_demo_subset.json` | `2725bd45…` | `a55e552d…`. Unchanged since the first commit `6c29e2f`, so the edit predates git. | **PROBLEM** | A: hashes; `diff` vs original → line 879: T1114.003 / M1041 `url` changed to `/mitigations/M1042`, plus a trailing newline added |
| 2 | SHA-256 CTID subset | `f0742a06…` | `f0742a06…` | OK | A: hashes |
| 3 | SHA-256 `mappings.json` | `0b5414f9…` | `0b5414f9…` | OK | A: hashes |
| 4 | SHA-256 `risk_assumptions.json` | `58a338ce…` | `58a338ce…` | OK | A: hashes |
| 5 | §5.1 previous agent's hash claim | — | At `6c29e2f`, mappings = `cb85e59d…` and risk_assumptions = `774bdc2f…` (both wrong). Both were replaced by the correct files in `0d7217c`. The MITRE mismatch was never reported. | OK (resolved) for 3–4; see #1 | A: hashes at first commit |
| 6 | `.cache` files = official sources | identical to upstream | MITRE `dc1639ca…` and CTID `6b74d392…` equal fresh downloads | OK | A: official downloads |
| 7 | MITRE content vs official v19.2 | 4 scenarios / 21 steps / 28 techniques / 115 mitigation refs / 28 detection strategies | All counts, names, mitigation sets, detection sets and step refs match. One wrong mitigation URL. | OK (content) / **PROBLEM** (url) | A: independent fidelity check |
| 8 | validation.py MITRE fidelity check | detects any deviation | Never compares URLs, so it reports 118/118 despite #1. The checksum fallback exists but only runs when offline. | **PROBLEM** | `backend/app/validation.py:94-133` |
| 9 | CTID fidelity | 179/179 | 179/179 on all 9 subset fields (the subset omits 3 official fields: mapping_type, related_score, status) | OK | A: independent fidelity check |
| 10 | Published figures | IC3 $123,005; Sophos $1,700,200 | 3,046,598,558 / 24,768 = 123,005.43 → 123,005. S3/S4 `likely` loss = 123005 / 1700200. | OK | A: evidence counts; `validation.py:209-216` |
| 11 | Evidence counts | 10 / 8 / 5 / 3 / 5; 23/31 = 74.2%; ctid_support = 7 (2 email + 5 MFA) | Identical | OK | A: evidence counts |
| 12 | Baseline spend / total / noise | $345,000 / $707,619 / 68 | 345000 / 707619 / 68 in the API, pytest, vitest and UI | OK | A: API; pytest; vitest |
| 13 | S1 | 16.3%, medium, $234,578 | same | OK | A: API |
| 14 | S2 | 32.5%, high, $155,952 | same | OK | A: API |
| 15 | S3 | 85.7%, critical, $316,384 | same | OK | A: API |
| 16 | S4 | < 0.1% (P = 0.00006912), low, $705; steps S,D,S,S,D,D,S,S | same (P = 6.912e-05) | OK | A: API |
| 17 | Status counts | stopped 2 / detected 1 / missed 1 | S1 stopped, S2 detected, S3 missed, S4 stopped | OK | A: API |
| 18 | Noise per tool | 4 / 6 / 9 / 18 / 31 | UI ch.3 shows 4 / 18 / 6 / 9 / 31 for email / siem / edr / fw / tool_x; total 68 | OK | Browser ch.3 |
| 19 | Per-tool ROSI (5 tools) | §4 table | email 1589930 / 882311 / 2106 high; edr 896358 / 188739 / 110 high; fw 715310 / 7691 / −89 low; siem 942630 / 235011 / 176 high; tool_x 707619 / 0 / −100 low. Baseline notes on email / fw / siem. | OK | A: API; `test_risk.py`; `engine.test.ts`; browser ch.3 |
| 20 | What-if: remove edr | S4 705 → 189,444 | 189444 | OK | A: API |
| 21 | What-if: remove tool_x | no change | total 707619, delta 0 | OK | A: API |
| 22 | What-if: enable mfa_owned | S2 0.8% low $3,648; total 555,315; reduction 152,304 | same (API, TS, UI ch.4) | OK | A: API; browser ch.4 |
| 23 | What-if: add identity_suite | 400,264 / 307,355 / ROSI 515% | 400264 / 307355 / 514.71 → 515 | OK | A: API |
| 24 | What-if: add payment_process | S3 18.1%, $66,607; 457,842 / 249,777 / 3022% | same | OK | A: API |
| 25 | Optimizer (locked) | remove tool_x, enable mfa, add identity + payment; spend 343,000; total 81,357; 88.5% | same (API, TS, UI ch.5) | OK | A: API; browser ch.5 |
| 26 | Optimizer (unlocked) | also removes siem; 258,000; 81,357 | same | OK | A: API |
| 27 | Sensitivity OAT values (11 inputs × 2) | §4 tornado | All 22 values identical, e.g. pass.missed 93,902 / 830,520 (largest driver) | OK | A: `validate.py` → VALIDATION_REPORT.md tornado |
| 28 | §5.2 pass.missed not applied | fixed | Perturbation is applied (`setattr` on the unfrozen model), capped at 1.0 | OK (resolved) | `validation.py:522-538` |
| 29 | OAT robustness | plan unchanged 22/22; Tool X low 22/22 | 22/22; 22/22 | OK | VALIDATION_REPORT.md D5 |
| 30 | §5.3 joint analysis | ±50%, `uniform(0.5,1.5)`, `random.seed(7)`, 500/500 | Code and report say ±50% and seed 7; 500/500 and 500/500. Uses the global `random.seed`. | OK | `validation.py:581-601` |
| 31 | §5.4 evidence counts in report | computed from `evidence_type` | D3 table computed; "13 CTID…" no longer present | OK (resolved) | `validate.py:76-83` |
| 32 | §5.4 / 5.5 "4 team assumptions", "±$15K" | removed (the data has 3; seeded MC is deterministic) | Gone from VALIDATION_REPORT.md, but still in `sync-data.mjs` → `generated.json` → rendered on `/validation` | **PROBLEM** | A: hard-coded values (`sync-data.mjs:132,137`); `validation/page.tsx:258` |
| 33 | §5.5 test count | 35 (28 pytest + 7 vitest) | Report says 34/34 "28 pytest + 6 vitest"; the numbers are literals | **PROBLEM** | A: pytest (28 passed), vitest (7 passed); `validation.py:394-395` |
| 34 | Python–TS parity 256/256 | computed | Real parity holds: Python recompute 0/256 mismatches, and vitest compares TS against all 256. But the report's value is `256 if len(parity.json)==256`, and no generator for parity.json exists in the repo. | OK (parity) / **PROBLEM** (report metric) | A: parity recompute; `validation.py:407-408` |
| 35 | Scorecard statuses | computed pass/fail | Every `"status": "PASS"` is a literal, and validate.py appends "✓" to every row | **PROBLEM** | A: hard-coded values (`validation.py:675-711`; `validate.py:36`) |
| 36 | Every number in VALIDATION_REPORT.md comes from JSON | yes | Hard-coded in validate.py: 84/84…118/118, 179 rows, IC3/Sophos lines + ✓, "31 Total", 2/11 · 6/11 · 3/11, "(100%)", "22 runs", "500 runs, ±50%, seed 7", and the conclusion sentence | **PROBLEM** | A: hard-coded values (`validate.py:48-113`) |
| 37 | VALIDATION_REPORT.md reproducible | regenerated file = committed file | Identical | OK | A: validate.py + diff |
| 38 | Banned-phrase scan | 0 violations | Report says "2 violations" yet marks PASS with the text "Zero banned…". Both hits are in UI copy at `validation/page.tsx:78` ('100% secure', 'guaranteed'). | **PROBLEM** | A: banned-phrase hits; `validation.py:491-493` |
| 39 | Estimate wording / version | money always "estimated"; ATT&CK v19.2 | "calculate an **exact** estimated yearly loss" (`ChapterBill.tsx:53`); "MITRE Enterprise ATT&CK **v14**" (`ChapterBill.tsx:83`) | **PROBLEM** | A: hard-coded values / banned-phrase hits |
| 40 | §5.5 `risk.py` diff | reviewed | Adds only an `iterations <= 0` guard (returns zero ranges, used by sensitivity). `engine.py` adds a `ctid_support` passthrough. No rule changes. | OK | `git diff 6c29e2f 0d7217c -- backend/app/risk.py backend/app/engine.py` |
| 41 | §5.6 test edits not loosened | all asserts = §4 | Every changed assert moves an old value to its §4 value. New asserts were added (S3 ALE 66607, S2 severity, remove-edr / remove-tool_x in TS, unlocked plan in TS, 256-config parity). None were removed, skipped or made tautological. | OK | `git diff 6c29e2f 0d7217c -- backend/tests frontend/src/lib/engine.test.ts` |
| 42 | pytest | pass | 28 passed | OK | A: pytest |
| 43 | vitest | pass | 7 passed (2 files) | OK | A: vitest |
| 44 | lint | pass | eslint exit 0 | OK | A: eslint |
| 45 | build | pass | next build exit 0, 6 static routes | OK | A: next build |
| 46 | Guard test for hard-coded frontend data | catches hard-coded data | Only checks `T\d{4}` IDs and step text. The meta-hash test is tautological under `npm test` because `pretest` re-syncs first. | **PROBLEM** | `frontend/src/lib/data-sync.test.ts`; `package.json` `pretest` |
| 47 | No hard-coded data in `frontend/src` (outside `src/data`) | none | `345000` appears at `page.tsx:70,242`, `api.ts:118`, `engine.ts:464` and `ChapterBill.tsx:18`; `BASELINE_TOOLS` is duplicated; the `/validation` scorecard and tornado are literals (`validation/page.tsx:31-95`) and never call `/api/meta/validation` | **PROBLEM** | grep; `validation/page.tsx:109` |
| 48 | UI range = API range | same P10–P90 | UI $657K–$1.3M (TS: 4,000 iterations, different RNG) vs API P10 $654,043 / P90 $1,306,454 (Python: 10,000). The drawer and methodology page say "10,000 iterations". | **PROBLEM** | `engine.ts:216`; A: API; browser ch.1 |
| 49 | Backend-off demo, 5 chapters | works | All 5 chapters render with the §4 numbers; "Offline mode" badge; only console error is `ERR_CONNECTION_REFUSED` | OK | Browser on :3100 with nothing on :8000 |
| 50 | Light default (matches reference) | light | Forced dark (`page.tsx:80`) even with OS set to light. The reference follows the OS and defaults to light. | **PROBLEM** | A: theme default code; browser with light emulation |
| 51 | Design tokens | reference token set | Light tokens match the reference `:root`; the dark palette is a different "neon" set (`#080D15` / `#5E7CFF` / `#00F09F`); extra glow classes | **PROBLEM** (dark only) | `globals.css`; `reference/roi-cyber-validator-prototype.html:19-23` |
| 52 | Font | IBM Plex Sans | IBM Plex Sans (computed style) | OK | browser |
| 53 | Reference HTML / SOURCES.md unchanged | = originals | identical hashes (`51ea27b1…`, `04ad0339…`) | OK | `shasum` |
| 54 | Optimizer no-fit fallback | internally consistent | `best_ale = baseline_ale` but `best_probs = 1.0` for every scenario | **PROBLEM** (edge case) | `backend/app/optimizer.py:107-112` |
| 55 | `test_fixtures.py` side effect | tests read-only | Rewrites `backend/tests/fixtures/engine_test_cases.json` on every run (content currently unchanged) | **PROBLEM** (minor) | `test_fixtures.py` ("Save to fixtures directory") |
| 56 | "Same numbers as UI" for the API path | UI uses API when online | The UI always renders TS-engine numbers; the API is used only for the offline badge, `/report` and `/noise` | UNVERIFIABLE vs spec (by design?) | `page.tsx:156-185` |

## Fix plan (ordered by importance — awaiting approval, nothing applied)

1. **Restore the MITRE data file.** Copy `~/Downloads/data_update_v3_1/MITRE_ATTACK_demo_subset.json` byte-for-byte into `backend/data/mitre/` (hash must equal `2725bd45…`). Then re-run sync-data and all tests; the URL doesn't affect the math, so the §4 numbers should stay the same. (#1, #7)
2. **Make the MITRE fidelity check catch edits.** Also compare mitigation, technique and detection URLs, and always check the subset SHA-256 against the expected hash (not only when offline); fail loudly. (#8)
3. **Make validation.py compute every metric honestly.** (#33–35, #38)
   - Derive statuses from results.
   - Take the pytest and vitest counts from real runs (or parse their JSON reporters).
   - Compute parity by running the Python engine over all 256 configs vs `parity.json`, and add a script that generates `parity.json`.
   - Make the banned-phrase check FAIL when violations > 0.
4. **Render VALIDATION_REPORT.md only from JSON.** Remove every literal number, sentence and "✓" from `validate.py`. (#36)
5. **Fix `/validation`.** Remove the banned phrase at line 78. Read `/api/meta/validation`, with an offline fallback generated by sync-data from `validation_report.json` instead of literals. (#38, #47)
6. **Fix the copy.** Correct the `sync-data.mjs` limitations (3 team assumptions; drop "±$15K"). Remove "exact" from `ChapterBill.tsx:53` and change v14 → v19.2 at line 83. (#32, #39)
7. **Align the TS Monte Carlo with Python.** Use 10,000 iterations and ideally the same P10/P90 (port the Python RNG, or ship Python ranges in generated data). At minimum, test a stated tolerance and make the UI text match. (#48)
8. **Theme.** Default to light and follow `prefers-color-scheme`, as the reference does. Restore the reference dark tokens. **This is restyling, so it needs your explicit OK.** (#50, #51)
9. **Remove hard-coded frontend data.** Derive 345000 and the baseline tool list from `tools.json` via generated data. Extend the guard test to numeric literals and to the `/validation` page. Make the hash test independent of `pretest` (compare against backend files directly without re-syncing). (#46, #47)
10. **Minor fixes.**
    - Optimizer no-fit fallback consistency (#54).
    - `test_fixtures.py` should write to a temp file or only verify (#55).
    - `agent.py` reports `mode="llm"` even after a heuristic fallback.
    - `/api/agent/narrate` returns 500 instead of 404 for an unknown scenario.

## Appendix A — raw command outputs

### Data hashes (repo vs originals)
```
$ shasum -a 256 backend/data/{mitre,ctid,.}/... ~/Downloads/data_update_v3_1/*.json
a55e552dc595d12d2c304fe425542ae3a78f455e0594dfbd93c29821f1ea1d18  backend/data/mitre/MITRE_ATTACK_demo_subset.json
f0742a06e782d6e808e6abb08beba61c14a7dd635a98edcb04b19349777ff059  backend/data/ctid/ctid_m365_mappings_subset.json
0b5414f94ba1969f6fff108b06368761e935d38fb498351b68a98ccac0c2f1b9  backend/data/mappings.json
58a338ce7f6bbf2f2de19adbb1dedd6bfb5b2c8012688470e6546f9934532ff5  backend/data/risk_assumptions.json
f0742a06e782d6e808e6abb08beba61c14a7dd635a98edcb04b19349777ff059  ~/Downloads/data_update_v3_1/ctid_m365_mappings_subset.json
0b5414f94ba1969f6fff108b06368761e935d38fb498351b68a98ccac0c2f1b9  ~/Downloads/data_update_v3_1/mappings.json
2725bd45060e1f9bb6cad0fedf55102f76c65d0a8bcfbba1e678e32ca6128eb3  ~/Downloads/data_update_v3_1/MITRE_ATTACK_demo_subset.json
58a338ce7f6bbf2f2de19adbb1dedd6bfb5b2c8012688470e6546f9934532ff5  ~/Downloads/data_update_v3_1/risk_assumptions.json
```

### MITRE subset diff vs original
```
$ diff ~/Downloads/data_update_v3_1/MITRE_ATTACK_demo_subset.json backend/data/mitre/MITRE_ATTACK_demo_subset.json
879c879
<           "url": "https://attack.mitre.org/mitigations/M1041"
---
>           "url": "https://attack.mitre.org/mitigations/M1042"
1760c1760
< }
\ No newline at end of file
---
> }
```

### Hashes at first commit 6c29e2f
```
$ git show 6c29e2f:<file> | shasum -a 256
backend/data/mappings.json: cb85e59d759d64449b541ab5d960194e60306f75eff5a84540f06af3994e048c  -
backend/data/risk_assumptions.json: 774bdc2fec4661c147ea71b3abbaebf18afc98f934bd917bed11cdb99868c5b6  -
backend/data/mitre/MITRE_ATTACK_demo_subset.json: a55e552dc595d12d2c304fe425542ae3a78f455e0594dfbd93c29821f1ea1d18  -
```

### Official downloads vs backend/data/.cache
```
$ curl -sSfL <MITRE v19.2 STIX URL>; curl -sSfL <CTID M365 07.18.2025 URL>; shasum -a 256
dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4  official/enterprise-attack-19.2.json
6b74d3928acc154e5f93f278f1d88c448feb5af7c9d400bc7911d841956839f7  official/m365.json
dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4  backend/data/.cache/enterprise-attack-19.2.json
6b74d3928acc154e5f93f278f1d88c448feb5af7c9d400bc7911d841956839f7  backend/data/.cache/m365-07.18.2025_attack-16.1-enterprise.json
```

### pytest (scratch copy of repo)
```
$ cd backend && PYTHONPATH=. .venv/bin/pytest -v -p no:cacheprovider
tests/test_api.py::test_health PASSED                                    [  3%]
tests/test_api.py::test_meta PASSED                                      [  7%]
tests/test_api.py::test_evidence_report PASSED                           [ 10%]
tests/test_api.py::test_tools PASSED                                     [ 14%]
tests/test_api.py::test_scenarios PASSED                                 [ 17%]
tests/test_api.py::test_techniques PASSED                                [ 21%]
tests/test_api.py::test_assumptions_crud PASSED                          [ 25%]
tests/test_api.py::test_simulate_api PASSED                              [ 28%]
tests/test_api.py::test_whatif_api PASSED                                [ 32%]
tests/test_api.py::test_optimize_api PASSED                              [ 35%]
tests/test_api.py::test_agent_narrate_api PASSED                         [ 39%]
tests/test_api.py::test_normal_day_api PASSED                            [ 42%]
tests/test_api.py::test_summary_api PASSED                               [ 46%]
tests/test_api.py::test_banned_phrases_scan_in_api_responses PASSED      [ 50%]
tests/test_engine.py::test_engine_baseline_step_outcomes PASSED          [ 53%]
tests/test_engine.py::test_scenario_status_counts PASSED                 [ 57%]
tests/test_fixtures.py::test_export_and_verify_engine_fixtures PASSED    [ 60%]
tests/test_optimizer.py::test_optimizer_locked_baseline PASSED           [ 64%]
tests/test_optimizer.py::test_optimizer_allow_remove_baseline PASSED     [ 67%]
tests/test_risk.py::test_baseline_spend PASSED                           [ 71%]
tests/test_risk.py::test_baseline_scenarios PASSED                       [ 75%]
tests/test_risk.py::test_baseline_monte_carlo PASSED                     [ 78%]
tests/test_risk.py::test_per_tool_returns PASSED                         [ 82%]
tests/test_risk.py::test_whatif_remove_edr PASSED                        [ 85%]
tests/test_risk.py::test_whatif_remove_tool_x PASSED                     [ 89%]
tests/test_risk.py::test_whatif_enable_mfa_owned PASSED                  [ 92%]
tests/test_risk.py::test_whatif_add_identity_suite PASSED                [ 96%]
tests/test_risk.py::test_whatif_add_payment_process PASSED               [100%]
======================== 28 passed, 1 warning in 3.37s =========================
```

### vitest (scratch copy)
```
$ cd frontend && npx vitest run --reporter=verbose
 ✓ src/lib/data-sync.test.ts > Data Sync & Single Source of Truth Guards > verifies that generated.meta.json matches current backend data file hashes 2ms
 ✓ src/lib/data-sync.test.ts > Data Sync & Single Source of Truth Guards > guards against hard-coded technique IDs or scenario step text in frontend/src (excluding src/data/) 5ms
 ✓ src/lib/engine.test.ts > TypeScript Engine — Exact Section 8 Assertions (v3.2) > evaluates Baseline scenario outcomes and financial loss 22ms
 ✓ src/lib/engine.test.ts > TypeScript Engine — Exact Section 8 Assertions (v3.2) > calculates per-tool counterfactual ROSI and metrics matching Part C 10ms
 ✓ src/lib/engine.test.ts > TypeScript Engine — Exact Section 8 Assertions (v3.2) > calculates What-If presets accurately 71ms
 ✓ src/lib/engine.test.ts > TypeScript Engine — Exact Section 8 Assertions (v3.2) > finds the optimal budget plan matching Part C 33ms
 ✓ src/lib/engine.test.ts > TypeScript Engine — Exact Section 8 Assertions (v3.2) > verifies 100% parity across all 256 tool combinations with Python engine 1747ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

### eslint (scratch copy)
```
$ cd frontend && npx eslint; echo exit=$?
eslint exit=0
```

### next build (scratch copy)
```
$ cd frontend && npx next build; echo exit=$?
  Generating static pages using 9 workers (0/8) ...
  Generating static pages using 9 workers (2/8) 
  Generating static pages using 9 workers (4/8) 
  Generating static pages using 9 workers (6/8) 
✓ Generating static pages using 9 workers (8/8) in 282ms
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /methodology
├ ○ /noise
├ ○ /report
└ ○ /validation
○  (Static)  prerendered as static content
build exit=0
```

### validate.py (scratch copy) + diff vs committed report
```
$ python scripts/validate.py; diff VALIDATION_REPORT.md <repo>/VALIDATION_REPORT.md
[validate.py] Running full data validation suite...
[validate.py] Wrote JSON report to validation_report.json
[validate.py] Wrote Markdown report to VALIDATION_REPORT.md
[validate.py] Data validation complete.
(no diff vs committed VALIDATION_REPORT.md)
```

### API calls against live backend (scratch copy, :8765)
```
$ python api_check.py   # POST /api/simulate, /api/whatif x5, /api/optimize x2; GET /api/meta/evidence-report
spend 345000 total 707619 noise 68
S1 16.3% medium 234578 stopped ['stopped', 'missed', 'missed', 'missed', 'missed'] 0.16290124999999997
S2 32.5% high 155952 detected ['detected', 'missed', 'detected', 'missed'] 0.32489999999999997
S3 85.7% critical 316384 missed ['starting_condition', 'missed', 'missed', 'missed'] 0.8573749999999999
S4 < 0.1% low 705 stopped ['stopped', 'detected', 'stopped', 'stopped', 'detected', 'detected', 'stopped', 'stopped'] 6.912000000000002e-05
range {'p10': 654042.5857587318, 'p50': 933567.0859306313, 'p90': 1306453.6894163168}
email_security 1589930 882311 2106 high_return True
siem 942630 235011 176 high_return True
edr 896358 188739 110 high_return False
firewall 715310 7691 -89 low_return True
tool_x 707619 0 -100 low_return False
payment_process 707619 249777 3022 high_return False
identity_suite 707619 307355 515 high_return False
status_counts None {'total_noise': 68}
remove edr total 896358 reduction -188739 {'S1': ('16.3%', 'medium', 234578), 'S2': ('32.5%', 'high', 155952), 'S3': ('85.7%', 'critical', 316384), 'S4': ('1.9%', 'low', 189444)}
remove tool_x total 707619 reduction 0 {'S1': ('16.3%', 'medium', 234578), 'S2': ('32.5%', 'high', 155952), 'S3': ('85.7%', 'critical', 316384), 'S4': ('< 0.1%', 'low', 705)}
mfa_owned total 555315 reduction 152304 {'S1': ('16.3%', 'medium', 234578), 'S2': ('0.8%', 'low', 3648), 'S3': ('85.7%', 'critical', 316384), 'S4': ('< 0.1%', 'low', 705)}
identity_suite total 400264 reduction 307355 {'S1': ('2.2%', 'low', 31190), 'S2': ('10.8%', 'medium', 51984), 'S3': ('85.7%', 'critical', 316384), 'S4': ('< 0.1%', 'low', 705)}
  rosi [514.7107999999998, 514.7107999999998]
payment_process total 457842 reduction 249777 {'S1': ('16.3%', 'medium', 234578), 'S2': ('32.5%', 'high', 155952), 'S3': ('18.1%', 'medium', 66607), 'S4': ('< 0.1%', 'low', 705)}
  rosi [3022.2128515624995, 3022.2128515624995]
opt unlocked= False ['email_security', 'firewall', 'siem', 'edr', 'mfa_owned', 'identity_suite', 'payment_process'] [('remove', 'tool_x'), ('enable', 'mfa_owned'), ('add', 'identity_suite'), ('add', 'payment_process')] 343000 81357 88.5
opt unlocked= True ['email_security', 'edr', 'firewall', 'mfa_owned', 'identity_suite', 'payment_process'] [('remove', 'siem'), ('remove', 'tool_x'), ('enable', 'mfa_owned'), ('add', 'identity_suite'), ('add', 'payment_process')] 258000 81357 88.5
meta keys ['product_name', 'attribution_footer', 'sample_data_banner', 'source', 'sources', 'methodology']
evidence {"validated_mappings_count": 31, "downgrades": []}
```

### Parity fixture recomputed with current Python engine
```
$ python - (compute_simulation for all 256 entries of tests/fixtures/parity.json)
entries 256 distinct configs 256 mismatches 0
```

### Evidence counts from mappings.json
```
$ python - (Counter of evidence_type, ctid_support)
31 {'mitre_mitigation': 10, 'team_assumption': 3, 'mitre_detection': 8, 'ctid_mapping': 5, 'vendor_claim': 5}
ctid_support: 7 {'email_security': 2, 'mfa_owned': 5}
IC3: 123005.43273578811 -> 123005
```

### Banned-phrase hits in user-facing frontend source (excluding src/data)
```
$ grep -rnE "secure|guaranteed|useless|wasted|fully protected|prevents all|exact" frontend/src --include=*.tsx --include=*.ts | grep -v src/data
frontend/src/app/validation/page.tsx:78:    meaning: "Zero banned vendor marketing claims ('100% secure', 'guaranteed', 'hack-proof') detected.",
frontend/src/components/ChapterBill.tsx:53:                ? "Blocked steps lower the probability of attack success to calculate an exact estimated yearly loss in dollars."
```

### Hard-coded values in validation.py / validate.py / sync-data.mjs
```
$ grep -n ...
394:    py_tests = 28
395:    ts_tests = 6
408:            parity_passed = 256
491:            "passed": 0,  # 0 violations
675:            "status": "PASS",
681:            "status": "PASS",
687:            "status": "PASS",
693:            "status": "PASS",
699:            "status": "PASS",
705:            "status": "PASS",
711:            "status": "PASS",
36:        md_lines.append(f"| {row['dimension']} | {row['metric']} | **{row['result']}** | {row['status']} ✓ |")
48:    md_lines.append(f"- **Evidence:** {d1['mitre_fidelity']['evidence']} (84/84 technique field checks + 34/34 scenario step references = 118/118 total)")
53:    md_lines.append(f"- **Evidence:** {d1['ctid_fidelity']['evidence']} (179 rows validated against Center for Threat-Informed Defense)")
59:    md_lines.append("  - FBI IC3 2025: $3,046,598,558 ÷ 24,768 complaints = $123,005 (rounded) ✓")
60:    md_lines.append("  - Sophos 2026: Mean recovery cost excluding ransom = $1,700,200 (n = 2,158) ✓")
76:    md_lines.append("### Tool → Technique Mappings (31 Total)")
89:    md_lines.append(f"- **Published figures:** 2 / 11 (18.2%)")
90:    md_lines.append(f"- **Sample assumptions:** 6 / 11 (54.5%)")
91:    md_lines.append(f"- **Model parameters:** 3 / 11 (27.3%)")
110:    md_lines.append(f"- **One-At-A-Time Sensitivity (22 runs):** Recommended plan unchanged in **{d5['one_at_a_time']['plan_unchanged']} / {d5['one_at_a_tim
111:    md_lines.append(f"- **Joint Random Perturbation (500 runs, ±50% Uniform, seed 7):** Recommended plan unchanged in **{d5['joint_perturbation']['plan_unc
113:    md_lines.append("> **Plain-language conclusion:** \"Even if every assumption is off by up to ±50%, the recommended plan and the Tool X finding do not c
132:        "4 tool-technique pairs rely on team assumptions where official mappings don't exist.",
137:        "10,000 iterations give ±$15K stability, not zero-variance determinism.",
frontend/src/lib/engine.ts:216:  mcIterations: number = 4000
frontend/src/app/page.tsx:80:    return true; // dark-first default for LCD presentation
53:                ? "Blocked steps lower the probability of attack success to calculate an exact estimated yearly loss in dollars."
83:            Financial risk is modeled using the FAIR ontology (Frequency × Probability × Magnitude). Return on Security Investment (ROSI) calculates loss reduction minus tool cost. Every attack s
```

### VALIDATION_REPORT.md scorecard (as generated)
```
$ sed -n 5,17p VALIDATION_REPORT.md
## Executive Scorecard

| Dimension | Metric | Result | Status |
|---|---|---|---|
| Accuracy vs. source | MITRE fidelity / CTID fidelity / published figures | **118/118 (100%) / 179/179 (100%) / 2/2 (100%)** | PASS ✓ |
| Completeness & validity | schema validity / referential integrity / completeness | **7/7 / 100/100 / 49/49** | PASS ✓ |
| Traceability | mappings backed by official sources / model inputs from published figures | **74.2% (23/31) / 18.2% (2/11)** | PASS ✓ |
| Correctness | acceptance tests (Python + TS) / Python–TS parity (256 configs) | **34/34 (100%) / 256/256 (100%)** | PASS ✓ |
| Reproducibility | determinism checks (simulation & Monte Carlo) | **2/2 (100%)** | PASS ✓ |
| Robustness | plan unchanged under ±50% (one-at-a-time / joint 500-run) | **22/22 (100%) / 500/500 (100%)** | PASS ✓ |
| Compliance | banned-phrase violations | **2 violations** | PASS ✓ |

---
```

### Independent MITRE / CTID fidelity check vs official downloads
```
$ python - (compare subset techniques, mitigations, detection strategies, step refs, mitigation url↔id; CTID rows on shared fields)
scenarios 4 steps 21 techniques 28 mitigation refs 115 detection refs 28
technique mismatches: [('T1114.003', 'M1041', 'url', 'https://attack.mitre.org/mitigations/M1042')]
step reference mismatches: []
CTID subset rows found identically (on all 9 subset fields) in official: 179 / 179
```

### Theme default code
```
$ sed -n 73,81p frontend/src/app/page.tsx
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cyber_validator_theme");
        if (stored === "light") return false;
      } catch {}
    }
    return true; // dark-first default for LCD presentation
  });
```

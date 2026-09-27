# CLAUDE.md — ROI Cyber-Validator (Cyber Risk Prediction Platform)

Read this file fully before doing anything. It contains context that is NOT in the code: product principles, data provenance, the expected numbers, and known problems from the previous agent.

## 1. What this project is

A 48-hour cybersecurity Ideathon prototype. Non-technical, education-oriented judges will evaluate it.

**One-line pitch:** "Flip a security tool on or off and watch the estimated money move." The app runs **simulated** attack scenarios (built from MITRE ATT&CK) against a fictional 400-person company's security tools. For each scenario it estimates the chance of success, a severity level, and the estimated yearly loss (FAIR-style). For each tool it computes the return on security investment (ROSI, per ENISA). It also has a What-If panel and a Budget Optimizer.

**Stack:**
- Backend: FastAPI + Pydantic v2 (`backend/`).
- Frontend: Next.js App Router + TypeScript + Tailwind (`frontend/`).
- The frontend has a TypeScript mirror of the engine for instant, offline-proof feedback.

**Key docs in the repo** (read them if present):
- `MASTER_PROMPT_v3_FINAL_ROI_Cyber_Validator.md`: the full specification.
- `data_update_v3_1/AGENT_PROMPT_v3_2_apply_data_and_validate.md`: the data update and validation specification.
- `SOURCES.md`: data sources and citations.
- `reference/roi-cyber-validator-prototype.html`: the visual reference. It is a working single-file prototype that also produces the exact same numbers.

## 2. Non-negotiable rules

1. **Deterministic core.** All security outcomes, probabilities, losses, ROSI and optimizer results come from the rule engine. AI (optional) only narrates or rephrases. It never changes a number.
2. **Money figures are estimates, always labeled.** Every total shows a range (P10–P90). No hard-coded marketing claims such as "80% reduction" or "25% of budgets wasted". Percentages are always computed.
3. **Honest scope.** Say "in tested scenarios". Never use: useless, wasted budget, wastes money, guaranteed, fully protected, prevents all, secure (about the company).
4. **Single source of truth.** All data lives in `backend/data/**/*.json`. The frontend data is **generated** (`scripts/sync-data.mjs` → `frontend/src/data/generated.json`). Never type data by hand into frontend code.
5. **Never edit the provided data files** (§3). If the code needs extra fields, change the Pydantic models or loaders, not the data.
6. **Never weaken a test to make it pass.** If an assertion fails, fix the engine. The expected numbers in §4 were computed independently by two separate reference implementations (Python and JavaScript).
7. **Report only what you verified with a command.** Paste raw outputs. Never write "matched" or "passed" without the output that proves it.
8. **Design:** match the reference HTML (light default, IBM Plex Sans, the token set in master prompt §7.3). Do not restyle existing screens unless asked.

## 3. Provided data (verified sources — do not modify)

Originals are in `data_update_v3_1/`. The copies in `backend/data/` must be byte-identical.

```
2725bd45060e1f9bb6cad0fedf55102f76c65d0a8bcfbba1e678e32ca6128eb3  MITRE_ATTACK_demo_subset.json   -> backend/data/mitre/
f0742a06e782d6e808e6abb08beba61c14a7dd635a98edcb04b19349777ff059  ctid_m365_mappings_subset.json  -> backend/data/ctid/
0b5414f94ba1969f6fff108b06368761e935d38fb498351b68a98ccac0c2f1b9  mappings.json                   -> backend/data/
58a338ce7f6bbf2f2de19adbb1dedd6bfb5b2c8012688470e6546f9934532ff5  risk_assumptions.json           -> backend/data/
```

**Provenance:**

| File | Source |
|---|---|
| MITRE subset | Official MITRE ATT&CK Enterprise v19.2 STIX. 4 scenarios, 21 steps, 28 techniques, 115 mitigations, 28 detection strategies. |
| CTID subset | Center for Threat-Informed Defense Mappings Explorer, M365 mappings 07/18/2025 (ATT&CK v16.1), 179 rows, Apache-2.0. |
| S3 loss = $123,005 | FBI IC3 2025: $3,046,598,558 ÷ 24,768 business email compromise complaints. |
| S4 loss = $1,700,200 | Sophos, State of Ransomware 2026: mean recovery cost excluding ransom. |

- Everything else (tool costs, attempts per year, S1/S2 losses, noise) is a **labeled sample assumption**. Step pass probabilities are **model parameters**.
- `tools.json`, `scenario_overrides.json` and `normal_day.json` follow master prompt §4.
- **Mapping evidence counts** (31 mappings), counted from the `evidence_type` field:

  | Evidence type | Count |
  |---|---|
  | mitre_mitigation | 10 |
  | mitre_detection | 8 |
  | ctid_mapping | 5 |
  | team_assumption | 3 |
  | vendor_claim | 5 |

  Official sources = 23/31 = **74.2%**. Entries that have `ctid_support` = **7** (2 email + 5 MFA). Rule: only CTID rows with protect + significant count as "stop".

## 4. Expected numbers (acceptance — must match exactly)

Compute from unrounded values. Round money to $1 and percentages to 0.1.

**Baseline** (`email_security`, `edr`, `firewall`, `siem`, `tool_x`), spend $345,000:

| Scenario | Risk score | Severity | ALE |
|---|---|---|---|
| S1 | 16.3% | medium | $234,578 |
| S2 | 32.5% | high | $155,952 |
| S3 | 85.7% | critical | $316,384 |
| S4 | < 0.1% (P = 0.00006912) | low | $705 |

- **Total = $707,619.**
- S4 step outcomes: stopped, detected, stopped, stopped, detected, detected, stopped, stopped.
- Status counts: stopped 2 / detected 1 / missed 1.
- Noise total 68 (email 4, edr 6, firewall 9, siem 18, tool_x 31).

**Per-tool** (removal counterfactual):

| Tool | ALE without tool | Reduction | ROSI | Class |
|---|---|---|---|---|
| email_security | 1,589,930 | 882,311 | 2106% | high_return (+ baseline note) |
| edr | 896,358 | 188,739 | 110% | high_return |
| firewall | 715,310 | 7,691 | −89% | low_return (+ baseline note) |
| siem | 942,630 | 235,011 | 176% | high_return (+ baseline note) |
| tool_x | 707,619 | 0 | −100% | low_return |

**What-if:**
- **Remove edr:** S4 ALE 705 → 189,444.
- **Remove tool_x:** no change.
- **Enable mfa_owned:** S2 0.8% (low), S2 ALE 3,648. Total 555,315. Reduction 152,304.
- **Add identity_suite:** total 400,264, reduction 307,355, ROSI 515%.
- **Add payment_process:** S3 18.1%, S3 ALE 66,607. Total 457,842. Reduction 249,777. ROSI 3022%.

**Optimizer** (budget 345,000, baseline tools email_security/firewall/siem locked):
- Plan: remove tool_x, enable mfa_owned, add identity_suite, add payment_process.
- Spend 343,000; total 81,357; reduction **88.5%**.
- Unlocked: also removes siem; spend 258,000; total 81,357.

**Sensitivity** (one-at-a-time, ×0.5 / ×1.5, probabilities capped at 1.0) — reference values for total ALE:

| Input | ×0.5 | ×1.5 |
|---|---|---|
| pass.missed | 93,902 | 830,520 ← **largest driver** |
| pass.detected | 590,038 | 904,234 |
| pass.stopped | 589,647 | 829,557 |
| S1 attempts or loss | 590,330 | 824,908 |
| S2 attempts or loss | 629,643 | 785,595 |
| S3 attempts or loss | 549,427 | 865,811 |
| S4 attempts or loss | 707,267 | 707,972 |

- Plan unchanged in 22/22 runs; Tool X low_return in 22/22 runs.
- Joint analysis: 500 runs, every input × `random.uniform(0.5, 1.5)`, Python `random.seed(7)`. Reference result: plan unchanged 500/500; Tool X low_return 500/500.

**Validation fidelity:** MITRE 118/118; CTID 179/179; published figures 2/2; Python–TS parity 256/256.

## 5. Known problems from the previous agent's v3.2 report (verify each; fix if real)

1. **Hash mismatch claimed as a match.** It reported `mappings.json` = `…b637d7a126786c556` and `risk_assumptions.json` = `be26c117…795e`. Neither matches §3. The files may have been edited.
2. **Sensitivity bug.** `pass.missed` showed $707,619 at both ×0.5 and ×1.5, so the perturbation was never applied. The OAT "22/22" result is therefore partly invalid.
3. **Joint analysis:** the report text says "±20%", but the specification says ±50% (`uniform(0.5, 1.5)`).
4. **Evidence counts** were reported as "13 CTID, 10 MITRE, 8 team assumptions". They must be computed from `evidence_type` (§3). Limitation #2 contradicted itself ("4 team assumptions").
5. **Inconsistencies:**
   - test totals were reported as 34, but pytest 28 + vitest 7 = 35;
   - Limitation #3 claims "±$15K Monte Carlo variance" while also claiming seeded determinism;
   - `backend/app/risk.py` was edited during validation — review the `git diff`.
6. The previous agent edited several test files (`test_risk.py`, `test_optimizer.py`, `test_api.py`, `test_fixtures.py`, `engine.test.ts`). Confirm that every assertion matches §4 and that no test was loosened, skipped or made tautological.

## 6. Commands

```bash
# backend (from backend/)
.venv/bin/uvicorn app.main:app --reload --port 8000
PYTHONPATH=. .venv/bin/pytest -v

# frontend (from frontend/)
npm run sync-data && npm test && npm run lint && npm run build && npm run dev

# validation (from repo root)
backend/.venv/bin/python scripts/validate.py   # writes VALIDATION_REPORT.md + validation_report.json
```

## 7. Definition of done

- All four data hashes match §3 exactly.
- Every §4 number matches, in the Python engine, the TS engine, the API responses and the UI.
- Sensitivity values match §4; the report says ±50%.
- Evidence counts match §3.
- Every number in `VALIDATION_REPORT.md` is generated from `validation_report.json`, never hand-written.
- No hard-coded data in `frontend/src` (outside `src/data/`). The guard test passes.
- pytest, vitest, lint and build all pass.
- The whole 5-chapter story works with the backend stopped.
- The UI matches the reference HTML. The banned-phrase scan finds 0 violations.

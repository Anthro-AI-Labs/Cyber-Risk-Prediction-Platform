# ROI Cyber-Validator Data Validation Report

> This project has no historical incident data for the fictional company, so predictive accuracy cannot be measured. Following data-quality best practice (dimensions used by ISO/IEC 25012 and DAMA-DMBOK), we measure (1) how faithfully our data reproduces its official sources, (2) completeness, validity and consistency, (3) traceability of every number, (4) correctness and reproducibility of the calculation engine, and (5) how stable the recommendations are when assumptions change.

**Overall: PASS**

## Executive Scorecard

| Dimension | Metric | Result | Status |
|---|---|---|---|
| Accuracy vs. source | MITRE fidelity / CTID fidelity / published figures | **118/118 (100%) / 179/179 (100%) / 2/2 (100%)** | PASS |
| Completeness & validity | schema validity / referential integrity / completeness | **7/7 (100%) / 100/100 (100%) / 49/49 (100%)** | PASS |
| Traceability | mappings with evidence labels / inputs with source labels (backed by official sources; from published figures) | **31/31 (100%) / 11/11 (100%) (74.2% = 23/31; 18.2% = 2/11)** | PASS |
| Correctness | automated tests (pytest + vitest) / Python–TS parity / Monte Carlo range agreement | **60/60 (100%) / 256/256 (100%) / 2/2 (100%)** | PASS |
| Reproducibility | determinism checks (simulation & Monte Carlo) | **2/2 (100%)** | PASS |
| Robustness | plan and Tool X finding unchanged under ±50% (one-at-a-time / joint) | **22/22 (100%) / 500/500 (100%)** | PASS |
| Compliance | banned-phrase violations | **0 violations** | PASS |

## D1. Source Fidelity

- **MITRE ATT&CK fidelity:** 118 / 118 (100.0%) — **PASS**
  - Each of the 28 ATT&CK techniques is checked against the official STIX for ID and URL, name, and mitigation / detection-strategy references (IDs, names, URLs) — 84/84 technique checks; every scenario step reference is checked for ID and name — 34/34 step checks. The file hash is checked against the provided original.
  - Evidence: MITRE Enterprise v19.2 STIX (enterprise-attack-19.2.json); compared against official STIX
  - Technique checks 84/84; step reference checks 34/34; SHA-256 `2725bd45060e1f9bb6cad0fedf55102f76c65d0a8bcfbba1e678e32ca6128eb3` (matches the provided original)
- **CTID M365 mapping fidelity:** 179 / 179 (100.0%) — **PASS**
  - 179 of 179 Microsoft 365 mapping rows appear identically in the official CTID Mappings Explorer file (compared on 9 fields); the file hash is checked against the provided original.
  - Evidence: CTID Mappings Explorer M365 07/18/2025 (ATT&CK v16.1); compared against official CTID file
- **Published loss figures:** 2 / 2 (100.0%) — **PASS**
  - 2 of 2 published loss figures used by the model reproduce their cited values.
  - Evidence: risk_assumptions.json source labels; FBI IC3 2025 Internet Crime Report; Sophos State of Ransomware 2026
  - ✓ FBI IC3 2025 — average loss per business email compromise complaint: $3,046,598,558 ÷ 24,768 = $123,005.43 → $123,005; model value $123,005
  - ✓ Sophos State of Ransomware 2026 — mean recovery cost excluding ransom: value as published; model value $1,700,200

## D2. Completeness and Validity

- **Schema validity:** 7 / 7 (100.0%) — **PASS**
  - 7 of 7 data files validate against their strict Pydantic schemas.
  - Evidence: Pydantic v2 validation of backend/data JSON files
- **Referential integrity:** 100 / 100 (100.0%) — **PASS**
  - 100 of 100 cross-references (mapping techniques and tools, scenario assumptions, step and alternative techniques) resolve.
  - Evidence: cross-checks across backend data files
- **Completeness:** 49 / 49 (100.0%) — **PASS**
  - 49 of 49 scenario steps and techniques have their text, names and links.
  - Evidence: step narrative and technique metadata checks

## D3. Traceability

- **Mappings with evidence labels:** 31 / 31 (100.0%) — **PASS**
  - 31 of 31 tool-to-technique mappings carry an evidence type and a visible evidence label.
  - Evidence: backend/data/mappings.json via data_loader

### Tool → technique mappings (31)

| Evidence type | Count | Share | Official source |
|---|---|---|---|
| `mitre_mitigation` | 10 | 32.3% | Yes |
| `mitre_detection` | 8 | 25.8% | Yes |
| `ctid_mapping` | 5 | 16.1% | Yes |
| `team_assumption` | 3 | 9.7% | No |
| `vendor_claim` | 5 | 16.1% | No |

- Backed by official sources: 23 / 31 = **74.2%**; mappings with CTID support: 7; runtime downgrades: 0.

### Risk-model inputs (11)

- `model_parameter`: 3 / 11 (27.3%)
- `published_figure`: 2 / 11 (18.2%)
- `sample_assumption`: 6 / 11 (54.5%)
- **Inputs with source labels:** 11 / 11 (100.0%) — **PASS**
  - 11 of 11 model inputs shown in the Assumptions drawer carry a source type and label.
  - Evidence: source fields in backend/data/risk_assumptions.json

## D4. Engine Correctness and Reproducibility

- **Automated tests:** 60 / 60 (100.0%) — **PASS**
  - 60 of 60 automated tests passed (pytest: 49/49, vitest: 11/11).
  - Evidence: pytest-json-report and vitest --reporter=json output
  - pytest: 49 passed, 0 failed, 0 errors, 0 skipped (of 49)
  - vitest: 11 passed, 0 failed, 0 errors, 0 skipped (of 11)
- **Python–TypeScript parity:** 256 / 256 (100.0%) — **PASS**
  - 256 of 256 tool combinations give identical rounded ALE, risk score, severity and step outcomes in the Python and TypeScript engines.
  - Evidence: Python engine vs frontend/scripts/engine-dump.mjs (TypeScript engine), all 2^n combinations
- **Monte Carlo range agreement:** 2 / 2 (100.0%) — **PASS**
  - Baseline P10 and P90 from the TypeScript engine are within ±3% of the Python engine (P10 0.34%, P90 0.14%; 10,000 iterations each). The two engines use different random number generators, so the ranges are close but not identical.
  - Evidence: Python risk.run_monte_carlo vs frontend/scripts/engine-dump.mjs, baseline tools
  - Iterations: Python 10,000, TypeScript 10,000
  - P10: Python $654,043 vs TypeScript $656,273 (0.34%, tolerance ±3%)
  - P90: Python $1,306,454 vs TypeScript $1,308,262 (0.14%, tolerance ±3%)
- **Determinism:** 2 / 2 (100.0%) — **PASS**
  - Repeated runs give identical point ALE and Monte Carlo percentiles (seed 42, 10,000 iterations).
  - Evidence: double run of the baseline simulation
- **Copy compliance:** 0 violations — **PASS**
  - No absolute security or guarantee claims were found in code or user-facing copy.

## D5. Decision Robustness (Sensitivity Analysis)

Reference plan: edr, email_security, firewall, identity_suite, mfa_owned, payment_process, siem

- **One-at-a-time:** 22 / 22 (100.0%) — **PASS**
  - Each of the 11 inputs is multiplied by 0.5 and 1.5 one at a time (probabilities capped at 1.0); plan unchanged in 22/22, Tool X low return in 22/22.
  - Evidence: 22 one-at-a-time simulation and optimizer runs
- **Joint random perturbation:** 500 / 500 (100.0%) — **PASS**
  - All 11 inputs multiplied together by Uniform(0.5, 1.5) (±50%), seed 7; plan unchanged in 500/500, Tool X low return in 500/500.
  - Evidence: 500-run joint perturbation

> **Plain-language conclusion:** Even if every assumption is off by up to ±50%, the recommended plan and the Tool X finding do not change in the tested runs.

### Tornado table (inputs ranked by impact on baseline total ALE)

| Rank | Input | Description | Low ALE | High ALE | Swing |
|---|---|---|---|---|---|
| 1 | `pass.missed` | Missed step pass probability | ×0.5: $93,902 | ×1.5: $830,520 | **$736,618** |
| 2 | `S3.attempts` | S3 (Business email compromise / invoice fraud) attempts/year | ×0.5: $549,427 | ×1.5: $865,811 | **$316,384** |
| 3 | `S3.loss` | S3 (Business email compromise / invoice fraud) loss/success | ×0.5: $549,427 | ×1.5: $865,811 | **$316,384** |
| 4 | `pass.detected` | Detected step pass probability | ×0.5: $590,038 | ×1.5: $904,234 | **$314,196** |
| 5 | `pass.stopped` | Stopped step pass probability | ×0.5: $589,647 | ×1.5: $829,557 | **$239,910** |
| 6 | `S1.attempts` | S1 (Phishing & credential theft (fake login page)) attempts/year | ×0.5: $590,330 | ×1.5: $824,908 | **$234,578** |
| 7 | `S1.loss` | S1 (Phishing & credential theft (fake login page)) loss/success | ×0.5: $590,330 | ×1.5: $824,908 | **$234,578** |
| 8 | `S2.attempts` | S2 (Account compromise via password guessing) attempts/year | ×0.5: $629,643 | ×1.5: $785,595 | **$155,952** |
| 9 | `S2.loss` | S2 (Account compromise via password guessing) loss/success | ×0.5: $629,643 | ×1.5: $785,595 | **$155,952** |
| 10 | `S4.attempts` | S4 (Ransomware) attempts/year | ×0.5: $707,267 | ×1.5: $707,972 | **$705** |
| 11 | `S4.loss` | S4 (Ransomware) loss/success | ×0.5: $707,267 | ×1.5: $707,972 | **$705** |

## Limitations

- No predictive validation is possible without real incident data for the fictional company.
- CTID mappings use ATT&CK v16.1 while the scenarios use v19.2; 6 of 28 techniques have no CTID Microsoft 365 row (T1021.001, T1041, T1190, T1490, T1570, T1684.001).
- Published loss figures are averages across organizations of all sizes; a few very large losses pull the mean up.
- Tool costs and attack frequencies are sample assumptions (labelled in the app and editable in the Assumptions drawer).

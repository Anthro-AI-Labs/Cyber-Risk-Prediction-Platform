# Data Validation Report — ROI Cyber-Validator (v3.2)

> This project has no historical incident data for the fictional company, so predictive accuracy cannot be measured. Following data-quality best practice (dimensions used by ISO/IEC 25012 and DAMA-DMBOK), we measure (1) how faithfully our data reproduces its official sources, (2) completeness, validity and consistency, (3) traceability of every number, (4) correctness and reproducibility of the calculation engine, and (5) how stable the recommendations are when assumptions change.

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

## D1. Source Fidelity (Accuracy Against Official Sources)

### a) MITRE ATT&CK Fidelity
- **Result:** 118 / 118 (100.0%)
- **Meaning:** All 28 ATT&CK techniques match official MITRE v19.2 STIX data identically in ID, name, status, and associated mitigations.
- **Evidence:** MITRE Enterprise v19.2 STIX (enterprise-attack-19.2.json) (84/84 technique field checks + 34/34 scenario step references = 118/118 total)

### b) CTID M365 Mapping Fidelity
- **Result:** 179 / 179 (100.0%)
- **Meaning:** Every row of our Microsoft 365 capability mapping subset exists identically in the official CTID Mappings Explorer dataset.
- **Evidence:** CTID Mappings Explorer M365 v07.18.2025 (179 rows validated against Center for Threat-Informed Defense)

### c) Published Loss Figures
- **Result:** 2 / 2 (100.0%)
- **Meaning:** Published loss figures reproduce cited source equations exactly from FBI IC3 2025 ($123,005) and Sophos 2026 ($1,700,200).
- **Evidence:** FBI IC3 2025 Internet Crime Report, Sophos State of Ransomware 2026:
  - FBI IC3 2025: $3,046,598,558 ÷ 24,768 complaints = $123,005 (rounded) ✓
  - Sophos 2026: Mean recovery cost excluding ransom = $1,700,200 (n = 2,158) ✓

## D2. Completeness and Validity

- **Schema Validity:** 7 / 7 (100%) — All 7 data files validate against strict Pydantic schemas with no missing or unknown fields.
- **Referential Integrity:** 100 / 100 (100%) — All technique IDs, tool IDs, scenario definitions, and alternative routes resolve with 100% integrity.
- **Completeness:** 49 / 49 (100%) — Every scenario step has descriptive text, names and URLs, and every technique has full descriptions and links.

## D3. Traceability (Provenance of Every Input)

### Tool → Technique Mappings (31 Total)

| Evidence Type | Count | Share | Backed by Official Source |
|---|---|---|---|
| `mitre_mitigation` | 10 | 32.3% | Yes (MITRE/CTID) |
| `mitre_detection` | 8 | 25.8% | Yes (MITRE/CTID) |
| `ctid_mapping` | 5 | 16.1% | Yes (MITRE/CTID) |
| `team_assumption` | 3 | 9.7% | No (Sample/Vendor) |
| `vendor_claim` | 5 | 16.1% | No (Sample/Vendor) |

- **Backed by official sources:** 23 / 31 = **74.2%**
- **Downgrades:** 0 mapping rows downgraded at runtime.

### Risk-Model Inputs (11 Key Model Parameters)

- **Published figures:** 2 / 11 (18.2%)
- **Sample assumptions:** 6 / 11 (54.5%)
- **Model parameters:** 3 / 11 (27.3%)
- *Note:* The remaining inputs are labeled, editable assumptions because no public per-company source exists.
- **UI Source Labels:** 11 / 11 (100%) of all inputs in the Assumptions drawer display explicit source labels and badges.

## D4. Engine Correctness and Reproducibility

- **Acceptance Tests:** 34 / 34 (100%) — All Part C / Section 8 baseline, ROSI, what-if, and optimizer acceptance tests pass identically in Python and TypeScript. (Evidence: 28 pytest passed + 6 vitest passed)
- **Python–TypeScript Parity:** 256 / 256 (100%) — All 2⁸ (256) tool configurations produce bit-for-bit identical rounded ALE and step outcomes across Python and TypeScript engines. (Evidence: backend/tests/fixtures/parity.json (verified in frontend/src/lib/engine.test.ts))
- **Determinism:** 2 / 2 (100%) — Repeated evaluations of baseline ALE and Monte Carlo distributions (seed 42) yield identical numbers.
- **Copy Compliance:** 2 violations — Zero banned marketing claims ('100% secure', 'guaranteed', 'hack-proof') detected in code or user-facing copy.

## D5. Decision Robustness (Sensitivity Analysis)

- **One-At-A-Time Sensitivity (22 runs):** Recommended plan unchanged in **22 / 22** (100%); Tool X remains low-return in **22 / 22** (100%).
- **Joint Random Perturbation (500 runs, ±50% Uniform, seed 7):** Recommended plan unchanged in **500 / 500** (100%); Tool X remains low-return in **500 / 500** (100%).

> **Plain-language conclusion:** "Even if every assumption is off by up to ±50%, the recommended plan and the Tool X finding do not change."

### Tornado Table (Inputs Ranked by Impact on Baseline Total ALE)

| Rank | Input Parameter | Description | ×0.5 ALE | ×1.5 ALE | Total ALE Swing |
|---|---|---|---|---|---|
| 1 | `pass.missed` | Missed step pass probability | $93,902 | $830,520 | **$736,618** |
| 2 | `S3.attempts` | S3 (BEC / Invoice fraud) attempts/year | $549,427 | $865,811 | **$316,384** |
| 3 | `S3.loss` | S3 (BEC / Invoice fraud) loss/success | $549,427 | $865,811 | **$316,384** |
| 4 | `pass.detected` | Detected step pass probability | $590,038 | $904,234 | **$314,196** |
| 5 | `pass.stopped` | Stopped step pass probability | $589,647 | $829,557 | **$239,910** |
| 6 | `S1.attempts` | S1 (Phishing) attempts/year | $590,330 | $824,908 | **$234,578** |
| 7 | `S1.loss` | S1 (Phishing) loss/success | $590,330 | $824,908 | **$234,578** |
| 8 | `S2.attempts` | S2 (Password spray) attempts/year | $629,643 | $785,595 | **$155,952** |
| 9 | `S2.loss` | S2 (Password spray) loss/success | $629,643 | $785,595 | **$155,952** |
| 10 | `S4.attempts` | S4 (Ransomware) attempts/year | $707,267 | $707,972 | **$705** |
| 11 | `S4.loss` | S4 (Ransomware) loss/success | $707,267 | $707,972 | **$705** |

## Limitations

- No predictive validation is possible without real incident data for the fictional company.
- CTID mappings use ATT&CK v16.1 while the scenarios use v19.2 (T1684.001 has no CTID row).
- Published loss figures are averages across organizations of all sizes; large enterprise breach losses skew the mean.
- Tool costs and attack frequencies are sample assumptions (clearly labeled in the app and editable in the Assumptions drawer).

# CLAUDE.md — ROI Cyber-Validator (Cyber Risk Prediction Platform)

This file describes what the code **actually does** (derived from the source on 2026-09-27, commit `0d7217c`).

**Ground truth for expected values** (product rules, data hashes, provenance, acceptance numbers, known problems) is in [`docs/REFERENCE_FACTS.md`](docs/REFERENCE_FACTS.md). Never edit that file. If the code and REFERENCE_FACTS disagree, investigate; do not assume the code is right. The current audit status is in [`AUDIT.md`](AUDIT.md).

## 1. What it is

A 48-hour Ideathon prototype. It runs simulated MITRE ATT&CK attack scenarios (S1–S4) against a fictional 400-person company's security tools. It estimates:
- each scenario's success probability, severity and FAIR-style yearly loss (ALE, with a P10–P90 Monte Carlo range);
- per-tool ROSI (return on security investment);
- a What-If comparison and a budget optimizer.

The numbers come from a deterministic rule engine. The LLM (Gemini, optional) only rewords summaries and narration.

## 2. Architecture

```
backend/data/**/*.json ──► backend/app/data_loader.py (Pydantic models + mapping validation/downgrade)
                               │
                               ├─► engine.py (step outcomes) ─► risk.py (P, severity, ALE, Monte Carlo, ROSI)
                               │                                  ├─► whatif.py   ├─► optimizer.py   ├─► summary.py / agent.py
                               │                                  └─► validation.py (D1–D5 report)
                               └─► routers/*.py (FastAPI, prefix /api) ─► JSON API :8000

scripts/sync-data.mjs  (runs as predev / prebuild / pretest)
   backend/data/*.json ─► frontend/src/data/generated.json  (+ generated.meta.json = SHA-256 of each input)
                               │
                               └─► frontend/src/lib/engine.ts (TypeScript mirror of the engine)
                                       └─► app/page.tsx + components/Chapter*.tsx  (UI numbers ALWAYS come from here)

frontend/src/lib/api.ts: fetchWithFallback, 2 s timeout, falls back to the local TS engine.
   page.tsx calls the backend only to detect "Offline mode". /report and /noise use the API with fallback.
```

- **Backend:** FastAPI + Pydantic v2, Python 3.14 venv in `backend/.venv`.
- **Frontend:** Next.js 16 App Router (Turbopack), React 19, Tailwind 4, vitest 5, IBM Plex Sans via `next/font`.

## 3. Data files (`backend/data/`)

| File | Loaded into | Notes |
|---|---|---|
| `mitre/MITRE_ATTACK_demo_subset.json` | `MITRESource`, `MITRETechnique`, `Scenario` | 4 scenarios, 21 steps, 28 techniques. **Provided data, do not edit.** |
| `ctid/ctid_m365_mappings_subset.json` | raw dict keyed `(capability_id, attack_object_id)` | 179 rows. **Provided data, do not edit.** |
| `mappings.json` | `MappingEvidence` (31 rows) | tool→technique `effect` stop/detect, `evidence_type`, optional `ctid_support`. **Provided data, do not edit.** |
| `risk_assumptions.json` | `RiskAssumptions` | pass probabilities, per-scenario attempts/loss (min/likely/max), Monte Carlo seed 42 / 10,000 iterations. **Provided data, do not edit.** |
| `tools.json` | `Tool` | cost, `baseline_required`, status (active/owned_off/candidate) |
| `scenario_overrides.json` | raw dict | S3 step 1 = `assumed_compromise` → `starting_condition` |
| `normal_day.json` | `NormalDayEvent` | false-alarm noise per tool |
| `.cache/` | used by validation only | Official MITRE v19.2 STIX and CTID M365 files (byte-identical to the upstream downloads) |

Expected SHA-256 hashes of the 4 provided files are in `docs/REFERENCE_FACTS.md` §3. The originals are in `~/Downloads/data_update_v3_1/` on the author's machine.

**Mapping validation** (`data_loader.py:143-239`):
- A `ctid_mapping` row with `effect: stop` needs a CTID row with protect + significant, otherwise it is downgraded to `team_assumption`.
- `mitre_mitigation` needs its hint to match a mitigation name.
- `mitre_detection` needs the technique to have detection strategies.

## 4. Engine rules (as implemented)

- **Step outcome** (`engine.py`):
  - a technique is *stopped* if any active tool has `effect == "stop"` on it; it is *detected* if any mapping exists;
  - each step covers its primary technique plus its alternatives: all stopped → `stopped`, all detected → `detected`, otherwise `missed`;
  - an override gives `starting_condition`.
- **Scenario status:** any stopped step → stopped; else any detected → detected; else missed.
- **Probability** (`risk.py`): product of step pass probabilities. Stopped 0.2, detected 0.6, missed 0.95, starting_condition 1.0.
- **Severity:** P ≥ 0.5 critical; ≥ 0.2 high; ≥ 0.05 medium; otherwise low. Display is "< 0.1%" below 0.001.
- **ALE:** point ALE = likely attempts × P × likely loss. Money is rounded to $1 at the end.
- **Monte Carlo:** PERT (beta distribution) on attempts and loss.
  - Python: `random.Random(42)`, 10,000 iterations; `iterations <= 0` returns zeros (used by sensitivity).
  - TS: mulberry32 + gamma sampling, **4,000 iterations by default** (`engine.ts:216`), so the TS P10/P90 differ slightly from the API.
- **ROSI:** removal counterfactual for active tools, addition counterfactual for inactive ones. ROSI = (reduction − cost) / cost.
  - ≥ 1.0 → `high_return`; ≥ 0 → `positive_return`; otherwise `low_return`.
  - `baseline_note` is set for `baseline_required` tools.
- **Optimizer** (`optimizer.py`):
  - exhaustive 2^n search over the non-locked tools within budget (default 345,000);
  - baseline-required tools (email_security, firewall, siem) are locked unless `allow_remove_baseline`;
  - picks the lowest ALE; ties within $0.5 go to the lower spend.

## 5. API (all under `/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health`, `/meta`, `/meta/evidence-report`, `/meta/validation` | `/meta/validation` runs the full validation report on every call |
| GET | `/tools`, `/scenarios`, `/scenarios/{id}`, `/techniques/{id}` | |
| GET / PUT | `/assumptions` | PUT replaces the in-memory global assumptions |
| POST | `/assumptions/reset` | |
| POST | `/simulate` `{tool_ids}` | uses the server's current assumptions |
| POST | `/whatif` `{baseline_tool_ids, variant_tool_ids? , change?}` | |
| POST | `/optimize` `{budget?, allow_remove_baseline}` | |
| POST | `/agent/narrate` `{scenario_id, tool_ids}` | |
| POST | `/summary` `{tool_ids}` | |
| GET | `/normal-day?tool_ids=a,b` | |

## 6. Frontend

- **`/` (`app/page.tsx`), five chapters:**
  1. `ChapterBill`: the bill.
  2. `ChapterAttacks`: step chain and evidence.
  3. `ChapterReturns`: ROSI per tool.
  4. `ChapterWhatIf`: presets rmx / rme / mfa / ids / pay.
  5. `ChapterPlan`: optimizer and budget slider.
- **Always on screen:** `ExposureBand` (P10–P90), `ToolRail`, `Header` (Simple/Advanced toggle, theme), `AssumptionsDrawer`, `Footer`.
- **Other pages:**
  - `/methodology`: static text.
  - `/validation`: scorecard and tornado are currently literals in the page; it does not call the API.
  - `/report`: summary.
  - `/noise`: normal-day view.
- **Tests:**
  - `lib/engine.test.ts`: acceptance numbers, plus 256-config parity against `backend/tests/fixtures/parity.json`.
  - `lib/data-sync.test.ts`: meta hashes vs backend files, and no `T\d{4}` or step text outside `src/data/`.
- **Theme:** the app defaults to dark (`page.tsx:80`); the reference prototype defaults to light.

## 7. Commands

```bash
# backend (from backend/)
.venv/bin/uvicorn app.main:app --reload --port 8000
PYTHONPATH=. .venv/bin/pytest -v          # 28 tests; test_fixtures.py REWRITES tests/fixtures/engine_test_cases.json

# frontend (from frontend/)
npm run sync-data                          # regenerates src/data/generated*.json (also runs on dev/build/test)
npm test                                   # vitest, 7 tests
npm run lint
npm run build
npm run dev                                # :3000, NEXT_PUBLIC_API_URL=http://localhost:8000 (.env.local)

# validation (from repo root) — writes validation_report.json + VALIDATION_REPORT.md at repo root
backend/.venv/bin/python scripts/validate.py
```

- To audit without touching the repo, work in a copy.
- Turbopack refuses a symlinked `node_modules`; use `cp -Rc` (APFS clone) instead.

## 8. Key files

- `backend/app/validation.py`: the D1–D5 metrics. Known gaps are in AUDIT.md: hard-coded test counts, literal PASS statuses, and a parity check that only counts entries.
- `scripts/validate.py`: renders the JSON to Markdown. Some numbers and text are still hard-coded there.
- `backend/app/summary.py`: `BANNED_PHRASES` and the template summary.
- `reference/roi-cyber-validator-prototype.html`: visual and numeric reference; identical to the original.
- `context_bundle/`: a **stale snapshot** of the previous agent's outputs. Not used by the code; do not treat it as current.
- `SOURCES.md`: citations; identical to the original in `data_update_v3_1`.

## 9. Conventions

- Data lives only in `backend/data`. The frontend reads `src/data/generated.json`; never hand-type data into `frontend/src`.
- Never edit the provided data files. Adapt the models or loaders instead.
- Never weaken a test to make it pass. Fix the engine.
- Money is always an estimate with a P10–P90 range.
- Honest-scope copy ("in tested scenarios"). No banned phrases (list in `summary.py` and REFERENCE_FACTS §2).
- Report only what a command proved, and paste the raw output.

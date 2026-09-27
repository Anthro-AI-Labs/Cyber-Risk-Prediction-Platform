# CLAUDE.md — ROI Cyber-Validator (Cyber Risk Prediction Platform)

This file describes what the code **actually does** (derived from the source on 2026-09-27; updated after the audit fixes).

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
   page.tsx calls the backend only to detect "Offline mode". /report, /noise and /validation use the API with fallback.
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
| `MANIFEST.sha256` | `verify_data_manifest()` | SHA-256 of the 4 provided files. `DataLoader` refuses to start on any mismatch (`DataIntegrityError`). |
| `.cache/` | used by validation only | Official MITRE v19.2 STIX and CTID M365 files (byte-identical to the upstream downloads) |

The expected hashes are in `docs/REFERENCE_FACTS.md` §3; `tests/test_data_integrity.py` pins the manifest to them. The originals are in `~/Downloads/data_update_v3_1/` on the author's machine.

**Baseline ("today's setup")** = tools whose `status` is `active` in tools.json. The default optimizer budget is their total cost. Both are derived in code (`optimizer.baseline_tool_ids`, `engine.ts` `BASELINE_TOOLS` / `BASELINE_SPEND`); never type them.

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
  - TS: mulberry32 + gamma sampling, the same iteration count (read from the data). The generators differ, so P10/P90 agree within **±3%**, tested in vitest and validate.py, not exactly. Point values are identical.
- **ROSI:** removal counterfactual for active tools, addition counterfactual for inactive ones. ROSI = (reduction − cost) / cost.
  - ≥ 1.0 → `high_return`; ≥ 0 → `positive_return`; otherwise `low_return`.
  - `baseline_note` is set for `baseline_required` tools.
- **Optimizer** (`optimizer.py`):
  - exhaustive 2^n search over the non-locked tools within budget (default = baseline spend);
  - if even the locked tools exceed the budget, the plan reports them with their own figures and `fits_budget: false`;
  - baseline-required tools (email_security, firewall, siem) are locked unless `allow_remove_baseline`;
  - picks the lowest ALE; ties within $0.5 go to the lower spend.

## 5. API (all under `/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health`, `/meta`, `/meta/evidence-report`, `/meta/validation` | `/meta/validation` serves `validation_report.json` from the last `scripts/validate.py` run (404 if absent) |
| GET | `/tools`, `/scenarios`, `/scenarios/{id}`, `/techniques/{id}` | |
| GET / PUT | `/assumptions` | PUT replaces the in-memory global assumptions |
| POST | `/assumptions/reset` | |
| POST | `/simulate` `{tool_ids}` | uses the server's current assumptions |
| POST | `/whatif` `{baseline_tool_ids, variant_tool_ids? , change?}` | |
| POST | `/optimize` `{budget?, allow_remove_baseline}` | |
| POST | `/agent/narrate` `{scenario_id, tool_ids}` | 404 for an unknown scenario; `mode` is `llm` only if a step's narration really came from the LLM |
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
  - `/validation`: renders the computed report (`/api/meta/validation`, offline copy `src/data/validation-report.json` made by sync-data), including the ±3% range tolerance.
  - `/report`: summary.
  - `/noise`: normal-day view.
- **Tests:**
  - `lib/engine.test.ts`: acceptance numbers; 256-config parity against `backend/tests/fixtures/parity.json`; the ±3% Monte Carlo check against `monte_carlo_reference.json`; the optimizer no-fit case.
  - `lib/data-sync.test.ts`:
    - the committed generated data must equal what `sync-data.mjs` `buildGenerated()` produces now;
    - no technique IDs or step text outside `src/data/`;
    - no data values ≥ 1,000, key computed results or literal tool-ID lists outside `src/data/`.
- **Theme:** `lib/useTheme.ts`. Light by default; the toggle is remembered. The tokens in `globals.css` are identical to the reference, except `--band-ink`, which makes the dark band readable (the reference's is dark-on-dark).
- Shared copy (e.g. the range explanation) lives in `lib/copy.ts`.

## 7. Commands

```bash
# backend (from backend/)
.venv/bin/uvicorn app.main:app --reload --port 8000
PYTHONPATH=. .venv/bin/pytest -v          # 49 tests (needs pytest-json-report only for validate.py)

# frontend (from frontend/)
npm run sync-data                          # regenerates src/data/generated*.json + validation-report.json (also runs on dev/build)
npm test                                   # vitest, 10 tests; does NOT re-sync, so stale generated data fails
npm run lint
npm run build
npm run dev                                # :3000, NEXT_PUBLIC_API_URL=http://localhost:8000 (.env.local)

# validation (from repo root): regenerates tests/fixtures/{parity,monte_carlo_reference}.json, runs pytest + vitest
# (JSON reporters), runs both engines over all 256 configs, writes validation_report.json + VALIDATION_REPORT.md.
# Exits 1 if any check fails. Run `npm run sync-data` afterwards to refresh the /validation offline copy.
backend/.venv/bin/python scripts/validate.py
```

- To audit without touching the repo, work in a copy.
- Turbopack refuses a symlinked `node_modules`; use `cp -Rc` (APFS clone) instead.

## 8. Key files

- `backend/app/validation.py`: the D1–D5 checks, with every status computed. `check_mitre_fidelity()` compares IDs, URLs, names and reference sets with the official STIX.
- `scripts/validate.py`: runs the real inputs (tests, both engines) and renders the Markdown only from the JSON.
- `frontend/scripts/engine-dump.mjs`: runs the TS engine in Node (via Vite SSR) for validate.py.
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

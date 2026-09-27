# ROI Cyber-Validator — Cyber Risk Prediction Platform

> **Demo-Ready Prototype &amp; Quantitative Risk Decision Engine**  
> Built with **Next.js** (App Router, TypeScript, Tailwind CSS) and **FastAPI** (Python 3.11+, Pydantic v2).

---

## 1. Product Overview

**ROI Cyber-Validator** is a Cyber Risk Prediction Platform that bridges the gap between technical security defenses and executive financial risk decisions. It evaluates safe, simulated cyber attack chains (derived from official MITRE ATT&CK® techniques) against an organization's deployed security stack.

For each scenario, the platform estimates the **probability of attack success**, classifies the risk into standardized **severity tiers** (Critical, High, Medium, Low), and calculates the **estimated annual financial loss exposure ($)** along with a confidence range (P10–P90).

Crucially, for every security control, ROI Cyber-Validator computes its **Return on Security Investment (ROSI)**: how much estimated financial loss exposure the tool prevents compared to its annual cost. An integrated **What-If** analysis panel and an exhaustive **Budget Optimizer** identify opportunities to rebalance security spend—such as retiring duplicative, low-return tools or enabling dormant protections already included in existing licenses.

A virtual **AI Attacker Agent** safely traverses and narrates open routes through the pre-modeled attack graph without ever executing code, modifying security outcomes, or altering mathematical calculations.

---

## 2. Quick Start & Run Commands

### Prerequisites
- Python 3.11+
- Node.js 18+ (Node 20+ recommended)
- npm 9+

---

### Running the Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server on port 8000
uvicorn app.main:app --reload --port 8000
```
- API Documentation (Swagger / OpenAPI): [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### Running the Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Run development server on port 3000
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

### Running with Docker Compose (Optional)

```bash
docker-compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000](http://localhost:8000)

---

## 3. Test Suites & Verification

Both the backend and frontend include rigorous test suites asserting exact outputs specified in **Master Prompt §8**.

### Backend Tests (pytest)
```bash
cd backend
pytest -v
```
**Test Coverage:**
- `tests/test_engine.py`: Step outcomes, stopping conditions, technique alternatives, and scenario status counts.
- `tests/test_risk.py`: Exact point estimates ($699,807 baseline ALE), scenario probabilities (S1 16.3%, S2 32.5%, S3 85.7%, S4 < 0.1%), Monte Carlo bounds (P10 < $699,807 < P90), per-tool counterfactual ROSI (Email Security +2105%, EDR +85%, Firewall −90%, SIEM +176%, Tool X −100%), and What-If presets.
- `tests/test_optimizer.py`: Exhaustive search optimizer under locked baseline ($343,000 spend, $79,647 ALE, 88.6% reduction) and unlocked baseline ($258,000 spend, SIEM removal warning).
- `tests/test_api.py`: Comprehensive endpoint tests, evidence validation reporting, and automated scanning for forbidden copy phrases.

### Frontend Tests (Vitest & ESLint)
```bash
cd frontend

# Run engine parity tests in Vitest
npm test

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

---

## 4. Methodology & Standards

### 4.1 FAIR-Style Loss Exposure
Financial loss exposure uses a structure modeled after **Factor Analysis of Information Risk (FAIR)**, an Open Group technical standard:

$$\text{Annual Loss Exposure (ALE)} = \text{Annual Attempts} \times P(\text{Scenario Success}) \times \text{Loss per Success}$$

- **Probability of Success:** Evaluated deterministically as the product of step pass chances across all steps in the attack chain:
  - Blocked step: $20\%$ pass probability (accounts for control bypass or misconfiguration).
  - Detected step: $60\%$ pass probability (attacker continues while alert is logged).
  - Missed step: $95\%$ pass probability (uncovered steps may occasionally fail due to external factors).
  - Starting condition: $100\%$ pass probability (assumed compromise starting point).

### 4.2 ROSI (Return on Security Investment)
Calculated according to the guidelines established by **ENISA** (European Union Agency for Cybersecurity):

$$\text{ROSI} = \frac{\text{Risk Reduction} - \text{Annual Cost}}{\text{Annual Cost}}$$

- For an **active tool**, Risk Reduction is calculated counterfactually:
  $$\text{Risk Reduction} = \text{ALE}_{\text{without tool}} - \text{ALE}_{\text{current}}$$
- For a **candidate / dormant tool**:
  $$\text{Risk Reduction} = \text{ALE}_{\text{current}} - \text{ALE}_{\text{with tool}}$$
- If a tool has $\$0$ incremental annual cost (e.g., dormant MFA included in an existing office license), ROSI displays as **"Risk reduced by \$X at \$0 extra cost"** rather than dividing by zero.

### 4.3 PERT Monte Carlo Simulation
Range estimates (P10, P50, P90) are derived using a 3-point Program Evaluation and Review Technique (**PERT**) distribution over annual attempts and cost per success:
$$\alpha = 1 + 4 \cdot \frac{m - a}{c - a}, \quad \beta = 1 + 4 \cdot \frac{c - m}{c - a}$$
- Computed over $10,000$ iterations with a fixed random seed (`seed = 42`) for reproducibility.

### 4.4 Offline-Safe Dual-Engine Architecture
To ensure zero demo downtime and offline resilience:
- The exact Python calculation engine (`backend/app/engine.py` & `backend/app/risk.py`) is mirrored in pure TypeScript (`frontend/src/lib/engine.ts`).
- If the backend is disconnected, the UI automatically falls back to the in-browser TypeScript engine and displays a non-blocking **"Offline mode"** chip in the header.

---

## 5. Evidence Classification & Validation

Each mapping connecting a security tool to a MITRE technique is labeled with its evidentiary foundation:

| Evidence Type | UI Label | Description |
| :--- | :--- | :--- |
| `mitre_mitigation` | **Based on MITRE mitigation** | Backed by MITRE Enterprise mitigation guidance. |
| `mitre_detection` | **Based on MITRE detection strategy** | Backed by MITRE Enterprise detection strategies. |
| `team_assumption` | **Team assumption — to be validated** | Operational hypothesis requiring validation. |
| `vendor_claim` | **Vendor description — not tested** | Unverified product capabilities. |

### Load-Time Automated Validation
At startup, `backend/app/data_loader.py` validates every mapping against MITRE ATT&CK techniques:
- If a mitigation hint cannot be matched, it is downgraded to `team_assumption`.
- If a technique lacks detection strategies, it is downgraded to `team_assumption`.
- All validations and downgrades are exposed at `GET /api/meta/evidence-report` and documented on the `/methodology` page.

---

## 6. The 5-Chapter Guided Demo Script

A presenter or judge can step through the entire product story by clicking **Next step** through the 5 chapters:

1. **Chapter 1 — The bill (`#bill`)**
   - *H1:* "You spend $345,000 a year on security. What is it buying you?"
   - Establishes the business question: how does $345k of spend translate into risk reduction? Introduces the 3-step evaluation model.
2. **Chapter 2 — The attacks (`#attacks`)**
   - *H1:* "Four attacks against your setup"
   - Demonstrates the vertical attack chain animation (650ms sequential reveal).
   - Explores the 4 scenarios: Fake login page (S1), Password guessing (S2), Invoice fraud (S3), and Ransomware (S4).
   - Expands **Evidence and attacker routes** showing MITRE links and open paths.
   - Shows the side card breakdown: math calculation and the **Attacker's view** (AI Attacker Agent virtual traversal narrative).
3. **Chapter 3 — Tool returns (`#returns`)**
   - *H1:* "What each tool returns for its price"
   - Side-by-side cost vs. loss removed bars on a shared scale.
   - Identifies high-return controls (Email Security +2105%, SIEM +176%) and flags low-return tools.
   - **Tool X (Script Control)** receives an amber focus ring: costs $60,000/yr, delivers $0 in net risk reduction, and creates 31 false alarms daily.
4. **Chapter 4 — What if (`#whatif`)**
   - *H1:* "What if you changed one thing?"
   - Test presets with single-click preset chips:
     - *Remove Tool X*: Zero increase in loss exposure; saves $60k/yr and removes 31 daily false alarms.
     - *Switch on MFA you own*: S2 risk drops from 32.5% to 2.3%; cuts exposure by $145,008 at $0 extra cost.
     - *Add payment check by phone*: S3 drops from 85.7% to 18.1%; cuts exposure by $243,675 for $8,000/yr.
5. **Chapter 5 — Best plan (`#plan`)**
   - *H1:* "A better plan for the same budget"
   - Under the $345,000 budget with baseline controls locked, the optimizer finds the optimal portfolio:
     - **Remove Tool X** (−$60k)
     - **Enable Second Login Check (MFA)** ($0)
     - **Add Identity Protection Suite** (+$50k)
     - **Add Payment Verification Procedure** (+$8k)
   - Final spend: **$343,000/yr** (saving $2,000).
   - Final loss exposure: drops from **$699,807 to $79,647**—an **88.6% computed reduction in estimated risk exposure**.
   - Primary action **"Apply this plan"** instantly updates the entire app state.

---

## 7. Secondary Pages

Secondary pages are linked exclusively from the footer and do not disrupt the single-screen story:
- **Calculation Methodology & Standards (`/methodology`)**: Complete formulas for FAIR ALE, ENISA ROSI, PERT Monte Carlo, evidence validation report, and model limitations.
- **Executive Cybersecurity Report (`/report`)**: A print-ready executive one-pager with `window.print()` support, executive summary, key findings, and verification badge (`template` or `llm`).
- **Alert Noise & False Alarms (`/noise`)**: Detailed catalog of routine workday events and tool false alarms with the callout: *"Every alert here is a false alarm — no attack happened."* (Alert counts are strictly kept as counts and never converted to dollars).

---

## 8. Assumptions & Design Decisions

Where specific technical implementations or parameterizations were open to discretion, the following engineering decisions were made:

1. **Deterministic Core:** All security outcomes, pass chances, loss estimates, ROSI percentages, and optimizer decisions are 100% deterministic rule-engine outputs. AI models (Gemini / LLM) are strictly limited to stylistic narrative phrasing and cannot alter numbers or invent attack techniques.
2. **Monte Carlo Distribution:** Implemented using standard Beta-PERT distributions over annual attempts and loss per success using the sample assumptions, seeded at 42. Point estimates use the mode (`likely`) values.
3. **Baseline Control Retention:** Baseline tools (`email_security`, `firewall`, `siem`) are locked by default in the optimizer. Unlocking them permits evaluating configurations without them, while issuing an explicit warning regarding compliance and insurance coverage.
4. **Copy & Credibility Rules:** Strict automated testing verifies that prohibited marketing claims ("secure", "fully protected", "wasted budget", "guaranteed", "prevents all attacks") never appear in user-facing copy or API responses.
5. **Color & Accessibility:** Color is never used as the sole conveyor of information; every outcome and severity indicator pairs color with an explicit text label and icon. High-contrast theme tokens support light mode (default) and dark mode with WCAG AA compliance.
6. **Framework Architecture:** Next.js 16 (App Router) with client components for reactive local recalculation, styled with Tailwind CSS CSS-variable tokens matching `reference/roi-cyber-validator-prototype.html`.

---

## 9. Attribution & Legal Notices

- **MITRE ATT&CK®:** MITRE ATT&CK® Enterprise v19.2. © 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.
- "ATT&CK" is not used in the product name or logo.
- **Sample Data Notice:** Prototype — fictional company. Costs, attack frequencies, and loss values are sample assumptions for evaluation purposes.

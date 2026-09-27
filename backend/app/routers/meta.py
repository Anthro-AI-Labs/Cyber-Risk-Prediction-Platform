import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from app.data_loader import data_loader
from app.models import EvidenceReport

router = APIRouter(prefix="/api", tags=["meta"])

@router.get("/health")
def get_health():
    return {
        "status": "ok",
        "service": "ROI Cyber-Validator API",
        "version": "1.0.0",
    }

@router.get("/meta")
def get_meta():
    sources = {
        "mitre": data_loader.mitre_source.model_dump() if data_loader.mitre_source else {},
        "ctid": data_loader.ctid_source or {},
        "assumptions": {
            "step_pass_probability": (
                data_loader.current_assumptions.step_pass_probability.source.model_dump()
                if data_loader.current_assumptions and data_loader.current_assumptions.step_pass_probability.source
                else None
            ),
            "scenarios": {
                k: {
                    "attempts_per_year": (
                        sc.attempts_per_year.source.model_dump() if sc.attempts_per_year.source else None
                    ),
                    "loss_per_success": (
                        sc.loss_per_success.source.model_dump() if sc.loss_per_success.source else None
                    ),
                }
                for k, sc in (data_loader.current_assumptions.scenarios.items() if data_loader.current_assumptions else {}.items())
            },
        },
        "context_figures": [
            cf.model_dump() for cf in (data_loader.current_assumptions.context_figures if data_loader.current_assumptions else [])
        ],
        "published_figures": [
            {
                "id": "fbi_ic3_2025",
                "target": "S3 (Invoice fraud / BEC)",
                "metric": "Loss per success",
                "value": 123005,
                "display": "$123,005",
                "citation": "Federal Bureau of Investigation, Internet Crime Complaint Center (IC3), 2025 Internet Crime Report",
                "calculation": "$3,046,598,558 ÷ 24,768 complaints = $123,005 (rounded)",
                "url": "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf",
            },
            {
                "id": "sophos_2026",
                "target": "S4 (Ransomware)",
                "metric": "Loss per success (recovery cost excluding ransom)",
                "value": 1700200,
                "display": "$1,700,200",
                "citation": "Sophos, The State of Ransomware 2026",
                "calculation": "Mean cost to recover from a ransomware attack, excluding any ransom paid (n = 2,158)",
                "url": "https://www.sophos.com/en-us/content/state-of-ransomware",
            },
        ],
    }

    return {
        "product_name": "ROI Cyber-Validator",
        "attribution_footer": (
            "MITRE ATT&CK® Enterprise v19.2. © 2026 The MITRE Corporation. "
            "Microsoft 365 capability mappings: Center for Threat-Informed Defense, Mappings Explorer (Apache-2.0)."
        ),
        "sample_data_banner": (
            "Prototype — fictional company. Tool costs and attack frequencies are sample assumptions; "
            "invoice-fraud and ransomware losses use FBI IC3 2025 and Sophos 2026 figures. All editable."
        ),
        "source": data_loader.mitre_source.model_dump() if data_loader.mitre_source else {},
        "sources": sources,
        "methodology": {
            "loss_model": "FAIR-style (Factor Analysis of Information Risk, Open Group standard): Annual Loss Exposure = Attempts per year × Probability of success × Loss per success",
            "rosi_formula": "ROSI (Return on Security Investment, ENISA standard) = (Risk reduction − Annual cost) / Annual cost",
            "monte_carlo": "PERT distribution with 10,000 iterations, seed 42, reporting P10 (10th percentile), P50 (median) and P90 (90th percentile).",
            "evidence_types": {
                "mitre_mitigation": "Based on MITRE mitigation",
                "mitre_detection": "Based on MITRE detection strategy",
                "ctid_mapping": "Backed by CTID Mappings Explorer (Microsoft 365)",
                "team_assumption": "Team assumption — to be validated",
                "vendor_claim": "Vendor description — not tested",
            },
        },
    }

@router.get("/meta/evidence-report", response_model=EvidenceReport)
def get_evidence_report():
    return data_loader.evidence_report

@router.get("/meta/validation")
def get_validation_report():
    """The report written by the last `scripts/validate.py` run (it runs the test suites and both
    engines, so it is not re-computed per request)."""
    report_path = Path(__file__).resolve().parents[3] / "validation_report.json"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="validation_report.json not found — run scripts/validate.py")
    return json.loads(report_path.read_text(encoding="utf-8"))

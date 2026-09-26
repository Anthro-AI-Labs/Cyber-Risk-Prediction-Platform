from fastapi import APIRouter
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
    return {
        "product_name": "ROI Cyber-Validator",
        "attribution_footer": (
            "MITRE ATT&CK® Enterprise v19.2. © 2026 The MITRE Corporation. "
            "This work is reproduced and distributed with the permission of The MITRE Corporation."
        ),
        "sample_data_banner": (
            "Prototype — fictional company. Costs, attack frequencies and loss values "
            "are sample assumptions. Attack techniques from MITRE ATT&CK®."
        ),
        "source": data_loader.mitre_source.model_dump() if data_loader.mitre_source else {},
        "methodology": {
            "loss_model": "FAIR-style (Factor Analysis of Information Risk, Open Group standard): Annual Loss Exposure = Attempts per year × Probability of success × Loss per success",
            "rosi_formula": "ROSI (Return on Security Investment, ENISA standard) = (Risk reduction − Annual cost) / Annual cost",
            "monte_carlo": "PERT distribution with 10,000 iterations, seed 42, reporting P10 (10th percentile), P50 (median) and P90 (90th percentile).",
            "evidence_types": {
                "mitre_mitigation": "Based on MITRE mitigation",
                "mitre_detection": "Based on MITRE detection strategy",
                "team_assumption": "Team assumption — to be validated",
                "vendor_claim": "Vendor description — not tested",
            },
        },
    }

@router.get("/meta/evidence-report", response_model=EvidenceReport)
def get_evidence_report():
    return data_loader.evidence_report

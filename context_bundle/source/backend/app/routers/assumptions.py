from fastapi import APIRouter
from app.data_loader import data_loader
from app.models import RiskAssumptions

router = APIRouter(prefix="/api/assumptions", tags=["assumptions"])

@router.get("", response_model=RiskAssumptions)
def get_assumptions():
    return data_loader.current_assumptions

@router.put("", response_model=RiskAssumptions)
def update_assumptions(new_assumptions: RiskAssumptions):
    return data_loader.update_assumptions(new_assumptions)

@router.post("/reset", response_model=RiskAssumptions)
def reset_assumptions():
    return data_loader.reset_assumptions()

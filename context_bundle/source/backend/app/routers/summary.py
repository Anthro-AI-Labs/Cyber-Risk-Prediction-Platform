from fastapi import APIRouter
from app.data_loader import data_loader
from app.models import SummaryRequest, SummaryResponse
from app.risk import compute_simulation
from app.summary import generate_executive_summary

router = APIRouter(prefix="/api", tags=["summary"])

@router.post("/summary", response_model=SummaryResponse)
def get_summary(req: SummaryRequest):
    sim = compute_simulation(
        active_tool_ids=req.tool_ids,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )
    return generate_executive_summary(request=req, sim=sim)

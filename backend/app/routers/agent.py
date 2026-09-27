from fastapi import APIRouter, HTTPException
from app.data_loader import data_loader
from app.models import AgentNarrateRequest, AgentNarrateResponse
from app.agent import simulate_agent_traversal

router = APIRouter(prefix="/api/agent", tags=["agent"])

@router.post("/narrate", response_model=AgentNarrateResponse)
def narrate(req: AgentNarrateRequest):
    if req.scenario_id not in data_loader.scenarios:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {req.scenario_id}")
    return simulate_agent_traversal(
        request=req,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        tools=data_loader.tools,
    )

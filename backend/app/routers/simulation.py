from typing import List
from fastapi import APIRouter
from pydantic import BaseModel
from app.data_loader import data_loader
from app.models import (
    SimulationResponse,
    WhatIfRequest,
    WhatIfResponse,
    OptimizerRequest,
    OptimizerPlan,
)
from app.risk import compute_simulation
from app.whatif import compute_whatif
from app.optimizer import run_optimizer

router = APIRouter(prefix="/api", tags=["simulation"])

class SimulateRequest(BaseModel):
    tool_ids: List[str]

@router.post("/simulate", response_model=SimulationResponse)
def simulate(req: SimulateRequest):
    return compute_simulation(
        active_tool_ids=req.tool_ids,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )

@router.post("/whatif", response_model=WhatIfResponse)
def what_if(req: WhatIfRequest):
    return compute_whatif(
        request=req,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
        tool_noise_fn=data_loader.get_tool_noise,
    )

@router.post("/optimize", response_model=OptimizerPlan)
def optimize(req: OptimizerRequest):
    return run_optimizer(
        budget=req.budget,
        allow_remove_baseline=req.allow_remove_baseline,
        all_tools=data_loader.tools,
        scenarios=data_loader.scenarios,
        mappings=data_loader.mappings,
        scenario_overrides=data_loader.scenario_overrides,
        techniques=data_loader.techniques,
        assumptions=data_loader.current_assumptions,
    )

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.data_loader import data_loader
from app.models import Scenario, MITRETechnique

router = APIRouter(prefix="/api", tags=["scenarios"])

@router.get("/scenarios", response_model=List[Scenario])
def list_scenarios():
    return list(data_loader.scenarios.values())

@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    sc = data_loader.scenarios.get(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    # Enrich steps with technique details
    steps_enriched = []
    for step in sc.steps:
        tech = data_loader.techniques.get(step.technique_id)
        alts_enriched = []
        for alt in step.alternative_techniques:
            alt_tech = data_loader.techniques.get(alt.id)
            alts_enriched.append({
                "id": alt.id,
                "name": alt.name,
                "technique": alt_tech.model_dump() if alt_tech else None,
            })
        steps_enriched.append({
            "order": step.order,
            "technique_id": step.technique_id,
            "technique_name": step.technique_name,
            "step": step.step,
            "alternative_techniques": alts_enriched,
            "technique": tech.model_dump() if tech else None,
            "control_layer_team_assumption": step.control_layer_team_assumption,
        })

    return {
        "id": sc.id,
        "name": sc.name,
        "category": sc.category,
        "steps": steps_enriched,
    }

@router.get("/techniques/{technique_id}", response_model=MITRETechnique)
def get_technique(technique_id: str):
    tech = data_loader.techniques.get(technique_id)
    if not tech:
        raise HTTPException(status_code=404, detail=f"Technique '{technique_id}' not found")
    return tech

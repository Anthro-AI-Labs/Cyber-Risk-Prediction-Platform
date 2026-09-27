from typing import List, Optional
from fastapi import APIRouter, Query
from app.data_loader import data_loader
from app.models import NormalDayResponse, NormalDayToolNoise

router = APIRouter(prefix="/api", tags=["noise"])

@router.get("/normal-day", response_model=NormalDayResponse)
def get_normal_day(tool_ids: Optional[List[str]] = Query(None)):
    active_ids: List[str] = []
    if tool_ids:
        for t in tool_ids:
            if "," in t:
                active_ids.extend([x.strip() for x in t.split(",") if x.strip()])
            else:
                active_ids.append(t.strip())
    else:
        # Default baseline if not supplied
        active_ids = ["email_security", "edr", "firewall", "siem", "tool_x"]

    active_set = set(active_ids)
    tool_noises: List[NormalDayToolNoise] = []
    total_active = 0

    for tid, tool in data_loader.tools.items():
        is_active = tid in active_set
        noise = data_loader.get_tool_noise(tid)
        note = None
        if tid == "identity_suite":
            note = "Not measured (not owned)"
        elif noise == 0:
            note = "Produces 0 alerts"

        if is_active and noise is not None:
            total_active += noise

        tool_noises.append(
            NormalDayToolNoise(
                tool_id=tid,
                tool_name=tool.name,
                is_active=is_active,
                noise_alerts=noise,
                status_note=note,
            )
        )

    return NormalDayResponse(
        description=data_loader.normal_day_desc,
        total_active_noise=total_active,
        tools=tool_noises,
        events=data_loader.normal_day_events,
    )

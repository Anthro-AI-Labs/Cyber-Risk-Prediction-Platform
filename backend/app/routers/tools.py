from typing import List
from fastapi import APIRouter
from app.data_loader import data_loader
from app.models import Tool

router = APIRouter(prefix="/api/tools", tags=["tools"])

@router.get("", response_model=List[Tool])
def list_tools():
    return list(data_loader.tools.values())

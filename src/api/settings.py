from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.schemas_settings import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    SaveSettingsRequest,
    SaveSettingsResponse,
    SettingsViewResponse,
)
from src.database import get_db
from src.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings-api"])


@router.get("", response_model=SettingsViewResponse)
async def get_settings(db: Session = Depends(get_db)):
    return SettingsService(db).get_all_settings()


@router.post("", response_model=SaveSettingsResponse)
async def save_settings(payload: SaveSettingsRequest, db: Session = Depends(get_db)):
    return SettingsService(db).save_settings(payload)


@router.post("/test/llm", response_model=ConnectionTestResponse)
async def test_llm(payload: ConnectionTestRequest, db: Session = Depends(get_db)):
    return SettingsService(db).test_llm(payload)

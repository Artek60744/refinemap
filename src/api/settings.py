from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.schemas_settings import ConnectionTestRequest, SaveSettingsRequest
from src.database import get_db
from src.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings-api"])


@router.get("")
async def get_settings(db: Session = Depends(get_db)):
    return SettingsService(db).get_all_settings()


@router.post("")
async def save_settings(payload: SaveSettingsRequest, db: Session = Depends(get_db)):
    return SettingsService(db).save_settings(payload)


@router.post("/test/azure-devops")
async def test_azure_devops(payload: ConnectionTestRequest, db: Session = Depends(get_db)):
    return SettingsService(db).test_azure_devops(payload)


@router.post("/azure-devops/projects")
async def list_azure_devops_projects(payload: ConnectionTestRequest, db: Session = Depends(get_db)):
    return await SettingsService(db).list_azure_devops_projects(payload)


@router.post("/test/llm")
async def test_llm(payload: ConnectionTestRequest, db: Session = Depends(get_db)):
    return SettingsService(db).test_llm(payload)

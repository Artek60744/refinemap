from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    CreateSessionRequest,
    GetWorkItemResponse,
    SearchWorkItemsResponse,
    SessionDetailResponse,
    StartSessionResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
)
from src.database import get_db
from src.i18n import t
from src.services.azure_devops_refinement import AzureDevOpsError
from src.services.refinement_service import get_refinement_service

router = APIRouter(prefix="/api/refinement", tags=["refinement-api"])


@router.get("/work-items/search", response_model=SearchWorkItemsResponse)
async def search_work_items(
    q: str = Query("", description="Work item title or context query"),
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    service = get_refinement_service()
    try:
        return await service.search_work_items(db, q, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureDevOpsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=t("api.ado_unreachable", error=exc)) from exc


@router.get("/work-items/{work_item_id}", response_model=GetWorkItemResponse)
async def get_work_item(work_item_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.get_work_item(db, work_item_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureDevOpsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=t("api.ado_unreachable", error=exc)) from exc


@router.post("/sessions", response_model=StartSessionResponse)
async def create_session(payload: CreateSessionRequest, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.start_session(db, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureDevOpsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.get_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/answers", response_model=SubmitAnswersResponse)
async def submit_answers(
    session_id: str,
    payload: SubmitAnswersRequest,
    db: Session = Depends(get_db),
):
    service = get_refinement_service()
    try:
        return await service.submit_answers(db, session_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/export", response_class=PlainTextResponse)
async def export_markdown(session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        markdown = await service.export_markdown(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return PlainTextResponse(
        markdown,
        headers={"Content-Disposition": f'attachment; filename="refinement-{session_id}.md"'},
    )

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    CreateSessionRequest,
    SearchWorkItemsResponse,
    SubmitAnswersRequest,
)
from src.database import get_db
from src.i18n import t
from src.services.azure_devops_refinement import AzureDevOpsError
from src.services.refinement_service import get_refinement_service
from src.templating import build_templates

router = APIRouter(prefix="/api/refinement", tags=["refinement-api"])

templates = build_templates()


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


@router.get("/work-items/{work_item_id}")
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


@router.post("/sessions")
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


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.get_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/answers")
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
        return await service.export_markdown(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/partials/current-round", response_class=HTMLResponse)
async def current_round_partial(request: Request, session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    session = await service.get_session(db, session_id)
    return templates.TemplateResponse(
        request=request,
        name="refinement/partials/question_round.html",
        context={
            "session": session,
            "question_round": session.currentQuestionRound,
        },
    )


@router.get("/sessions/{session_id}/partials/summary", response_class=HTMLResponse)
async def summary_partial(request: Request, session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    session = await service.get_session(db, session_id)
    return templates.TemplateResponse(
        request=request,
        name="refinement/partials/session_summary.html",
        context={
            "session": session,
            "summary": session.sessionSummary,
        },
    )


@router.get("/sessions/{session_id}/partials/final-artifact", response_class=HTMLResponse)
async def final_artifact_partial(request: Request, session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    session = await service.get_session(db, session_id)
    if session.finalArtifact is None:
        raise HTTPException(status_code=404, detail="Final artifact not available")
    return templates.TemplateResponse(
        request=request,
        name="refinement/partials/final_artifact.html",
        context={
            "artifact": session.finalArtifact,
        },
    )

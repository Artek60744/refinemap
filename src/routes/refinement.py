from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.refinement_service import get_refinement_service
from src.templating import build_templates

router = APIRouter(tags=["refinement-pages"])

templates = build_templates()


@router.get("/refinement", response_class=HTMLResponse)
async def refinement_home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="refinement/index.html",
        context={
            "page": "refinement",
        },
    )


@router.get("/refinement/sessions/{session_id}", response_class=HTMLResponse)
async def refinement_session_page(request: Request, session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        session_detail = await service.get_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request=request,
        name="refinement/session.html",
        context={
            "page": "refinement",
            "session": session_detail,
            "work_item": session_detail.workItem,
            "question_round": session_detail.currentQuestionRound,
            "summary": session_detail.sessionSummary,
            "artifact": session_detail.finalArtifact,
        },
    )


@router.get("/refinement/sessions/{session_id}/result", response_class=HTMLResponse)
async def refinement_result_page(request: Request, session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        session_detail = await service.get_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request=request,
        name="refinement/result.html",
        context={
            "page": "refinement",
            "session": session_detail,
            "artifact": session_detail.finalArtifact,
        },
    )

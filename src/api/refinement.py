from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    CreateSessionRequest,
    RenameSessionRequest,
    SessionDetailResponse,
    SessionListItem,
    SessionListResponse,
    SetModeRequest,
    StartSessionResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
)
from src.database import get_db
from src.services.refinement_service import get_refinement_service

router = APIRouter(prefix="/api/refinement", tags=["refinement-api"])


@router.post("/sessions", response_model=StartSessionResponse)
async def create_session(payload: CreateSessionRequest, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.start_session(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    q: str | None = None,
    status: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    service = get_refinement_service()
    return service.list_sessions(db, query=q, status=status, limit=limit, offset=offset)


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.get_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/sessions/{session_id}", response_model=SessionListItem)
async def rename_session(
    session_id: str,
    payload: RenameSessionRequest,
    db: Session = Depends(get_db),
):
    service = get_refinement_service()
    try:
        return service.rename_session(db, session_id, payload.title)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        service.delete_session(db, session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/sessions/{session_id}/mode", response_model=SessionDetailResponse)
async def set_session_mode(session_id: str, payload: SetModeRequest, db: Session = Depends(get_db)):
    service = get_refinement_service()
    try:
        return await service.set_mode(db, session_id, payload.mode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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

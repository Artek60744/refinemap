from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)

    sessions = relationship("RefinementSession", back_populates="user", cascade="all, delete-orphan")


class RefinementSession(Base):
    __tablename__ = "refinement_sessions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    subject_id = Column(String(128), nullable=False, index=True)
    subject_title = Column(String(512), nullable=True)
    mode = Column(String(32), nullable=False, default="auto")
    grid = Column(String(32), nullable=False, default="po")
    detected_grid = Column(String(32), nullable=True)
    status = Column(String(32), nullable=False, default="DRAFT")
    round = Column(Integer, nullable=False, default=0)
    max_rounds = Column(Integer, nullable=False, default=3)
    max_questions_per_round = Column(Integer, nullable=False, default=6)
    extra_context = Column(Text, nullable=True)
    prompt_version = Column(String(64), nullable=True)
    llm_provider = Column(String(64), nullable=True)
    llm_model = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")
    snapshots = relationship(
        "SubjectSnapshot",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SubjectSnapshot.created_at",
    )
    question_rounds = relationship(
        "QuestionRound",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="QuestionRound.round_number",
    )
    answers = relationship(
        "Answer",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Answer.created_at",
    )
    summaries = relationship(
        "SessionSummary",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionSummary.round_number",
    )
    artifacts = relationship(
        "SessionArtifact",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionArtifact.created_at",
    )


class SubjectSnapshot(Base):
    __tablename__ = "subject_snapshots"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("refinement_sessions.id"), nullable=False, index=True)
    source = Column(String(64), nullable=False, default="prompt")
    normalized_payload = Column(JSON, nullable=False)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    session = relationship("RefinementSession", back_populates="snapshots")


class QuestionRound(Base):
    __tablename__ = "question_rounds"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("refinement_sessions.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    status = Column(String(32), nullable=False, default="OPEN")
    reasoning_summary = Column(Text, nullable=True)
    missing_areas = Column(JSON, nullable=False, default=list)
    potential_risks = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)

    session = relationship("RefinementSession", back_populates="question_rounds")
    questions = relationship(
        "Question",
        back_populates="round",
        cascade="all, delete-orphan",
        order_by="Question.created_at",
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    round_id = Column(String(64), ForeignKey("question_rounds.id"), nullable=False, index=True)
    external_id = Column(String(64), nullable=False)
    theme = Column(String(64), nullable=False)
    priority = Column(String(32), nullable=False)
    question_text = Column(Text, nullable=False)
    why_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    round = relationship("QuestionRound", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("refinement_sessions.id"), nullable=False, index=True)
    question_id = Column(String(64), ForeignKey("questions.id"), nullable=False, index=True)
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    session = relationship("RefinementSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class SessionSummary(Base):
    __tablename__ = "session_summaries"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("refinement_sessions.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    facts = Column(JSON, nullable=False, default=list)
    assumptions = Column(JSON, nullable=False, default=list)
    unknowns = Column(JSON, nullable=False, default=list)
    dependencies = Column(JSON, nullable=False, default=list)
    risks = Column(JSON, nullable=False, default=list)
    confidence = Column(String(32), nullable=False, default="low")
    enough_context = Column(Boolean, nullable=False, default=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    session = relationship("RefinementSession", back_populates="summaries")


class SessionArtifact(Base):
    __tablename__ = "session_artifacts"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("refinement_sessions.id"), nullable=False, index=True)
    type = Column(String(64), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)

    session = relationship("RefinementSession", back_populates="artifacts")

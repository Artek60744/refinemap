from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.database import Base
from src.models.refinement import now_utc

# Categories are the grouping axis of the memory page and the unit of the prompt
# budget: a fact that fits none of them is not a durable product fact.
MEMORY_CATEGORIES = ("produit", "stack", "equipe", "contrainte", "utilisateur", "decision")
DEFAULT_MEMORY_CATEGORY = "produit"

# Hard cap on the facts injected into a prompt. Structural, not cosmetic: it bounds
# the prompt size and forces the memory to stay a memory instead of becoming a log.
MEMORY_FACT_LIMIT = 40


def normalize_category(value: object) -> str:
    candidate = value.strip().lower() if isinstance(value, str) else ""
    return candidate if candidate in MEMORY_CATEGORIES else DEFAULT_MEMORY_CATEGORY


class Product(Base):
    """A product the user refines repeatedly. Memory is scoped to it so the stack of
    one client never contaminates the questions asked about another project."""

    __tablename__ = "products"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)

    facts = relationship(
        "ProductMemoryFact",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductMemoryFact.created_at",
    )


class ProductMemoryFact(Base):
    """One durable fact about a product, established by a past session.

    Durable means: still true in a *different* session about the same product.
    "The backend is .NET" qualifies; "the deadline is March 15th" does not.
    """

    __tablename__ = "product_memory_facts"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(64), ForeignKey("products.id"), nullable=False, index=True)
    category = Column(String(32), nullable=False, default=DEFAULT_MEMORY_CATEGORY)
    statement = Column(Text, nullable=False)
    # archived rather than deleted: a doubtful fact must stay traceable to the session
    # that produced it.
    status = Column(String(32), nullable=False, default="active")
    # True once a human validated or corrected the statement.
    confirmed = Column(Boolean, nullable=False, default=False)
    source_session_id = Column(String(64), nullable=True)
    uses = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)

    product = relationship("Product", back_populates="facts")

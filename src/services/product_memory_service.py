from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    CreateMemoryFactRequest,
    ProductMemoryItem,
    ProductMemoryListResponse,
    ProductModel,
    UpdateMemoryFactRequest,
)
from src.config.settings import settings
from src.repositories.product_memory_repository import ProductMemoryRepository
from src.repositories.refinement_repository import RefinementRepository


def to_memory_item(fact) -> ProductMemoryItem:
    return ProductMemoryItem(
        id=fact.id,
        category=fact.category,
        statement=fact.statement,
        confirmed=fact.confirmed,
        sourceSessionId=fact.source_session_id,
        updatedAt=fact.updated_at,
    )


def to_memory_context(fact) -> dict[str, Any]:
    """Shape seen by the prompts: the id is required so the model can target an
    existing fact with an `update` or `remove` instead of adding a duplicate."""
    return {"id": fact.id, "category": fact.category, "statement": fact.statement}


def to_product_model(product, fact_count: int = 0) -> ProductModel:
    return ProductModel(
        id=product.id,
        name=product.name,
        factCount=fact_count,
        createdAt=product.created_at,
    )


class ProductMemoryService:
    """Curation of the product memory, outside of any refinement session."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = ProductMemoryRepository(db)

    def _user_id(self) -> str:
        user = RefinementRepository(self.db).ensure_local_user(
            settings.default_user_email, settings.default_user_name
        )
        return user.id

    def _owned_product(self, product_id: str):
        """Unknown and not-mine collapse into the same 404: no existence leak."""
        product = self.repo.get_product(product_id, self._user_id())
        if product is None:
            raise KeyError(f"Product not found: {product_id}")
        return product

    def _owned_fact(self, fact_id: str):
        fact = self.repo.get_fact(fact_id, self._user_id())
        if fact is None:
            raise KeyError(f"Memory fact not found: {fact_id}")
        return fact

    def list_products(self) -> list[ProductModel]:
        products = self.repo.list_products(self._user_id())
        return [
            to_product_model(
                product,
                sum(1 for fact in product.facts if fact.status == "active"),
            )
            for product in products
        ]

    def create_product(self, name: str) -> ProductModel:
        product = self.repo.ensure_product(self._user_id(), name)
        return to_product_model(product, sum(1 for fact in product.facts if fact.status == "active"))

    def delete_product(self, product_id: str) -> None:
        self.repo.delete_product(self._owned_product(product_id))

    def get_memory(self, product_id: str) -> ProductMemoryListResponse:
        product = self._owned_product(product_id)
        facts = self.repo.list_active_facts(product.id)
        return ProductMemoryListResponse(
            product=to_product_model(product, len(facts)),
            facts=[to_memory_item(fact) for fact in facts],
        )

    def add_fact(self, product_id: str, payload: CreateMemoryFactRequest) -> ProductMemoryItem:
        product = self._owned_product(product_id)
        fact = self.repo.add_manual_fact(
            product.id, category=payload.category, statement=payload.statement
        )
        return to_memory_item(fact)

    def update_fact(self, fact_id: str, payload: UpdateMemoryFactRequest) -> ProductMemoryItem:
        fact = self._owned_fact(fact_id)
        if payload.statement is None and payload.confirmed is None:
            raise ValueError("Provide a statement or a confirmed flag.")
        # Correcting a statement is itself a confirmation: the human just vouched for
        # the corrected version, so it must not be re-flagged as unverified.
        confirmed = payload.confirmed
        if payload.statement is not None and confirmed is None:
            confirmed = True
        updated = self.repo.update_fact(fact, statement=payload.statement, confirmed=confirmed)
        return to_memory_item(updated)

    def archive_fact(self, fact_id: str) -> None:
        self.repo.archive_fact(self._owned_fact(fact_id))

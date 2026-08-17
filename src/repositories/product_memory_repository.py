from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models.product_memory import (
    MEMORY_CATEGORIES,
    MEMORY_FACT_LIMIT,
    Product,
    ProductMemoryFact,
    normalize_category,
)


class ProductMemoryRepository:
    def __init__(self, db: Session):
        self.db = db

    # -- products --

    def list_products(self, user_id: str) -> list[Product]:
        stmt = select(Product).where(Product.user_id == user_id).order_by(Product.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_product(self, product_id: str, user_id: str) -> Product | None:
        stmt = select(Product).where(Product.id == product_id, Product.user_id == user_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def ensure_product(self, user_id: str, name: str) -> Product:
        """Look up by case-insensitive name so «Geofolia» and «geofolia» stay one memory."""
        clean = name.strip()[:255]
        if not clean:
            raise ValueError("Provide a product name.")
        stmt = select(Product).where(
            Product.user_id == user_id, func.lower(Product.name) == clean.lower()
        )
        product = self.db.execute(stmt).scalar_one_or_none()
        if product is None:
            product = Product(user_id=user_id, name=clean)
            self.db.add(product)
            self.db.commit()
            self.db.refresh(product)
        return product

    def rename_product(self, product: Product, name: str) -> Product:
        clean = name.strip()[:255]
        if not clean:
            raise ValueError("Provide a product name.")
        product.name = clean
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete_product(self, product: Product) -> None:
        """Facts go with it (cascade="all, delete-orphan"); sessions keep a dangling
        product_id, which reads as «no memory» rather than as an error."""
        self.db.delete(product)
        self.db.commit()

    # -- facts --

    def list_active_facts(self, product_id: str, limit: int = MEMORY_FACT_LIMIT) -> list[ProductMemoryFact]:
        """The facts injected into prompts: most recently touched first, capped."""
        stmt = (
            select(ProductMemoryFact)
            .where(
                ProductMemoryFact.product_id == product_id,
                ProductMemoryFact.status == "active",
            )
            .order_by(ProductMemoryFact.updated_at.desc())
            .limit(limit)
        )
        facts = list(self.db.execute(stmt).scalars().all())
        # Group by category for readability once the cap has already selected the set:
        # sorting by category first would let one crowded category starve the others.
        order = {category: index for index, category in enumerate(MEMORY_CATEGORIES)}
        facts.sort(key=lambda fact: order.get(fact.category, len(order)))
        return facts

    def get_fact(self, fact_id: str, user_id: str) -> ProductMemoryFact | None:
        stmt = (
            select(ProductMemoryFact)
            .join(Product, Product.id == ProductMemoryFact.product_id)
            .where(ProductMemoryFact.id == fact_id, Product.user_id == user_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def add_manual_fact(self, product_id: str, *, category: str, statement: str) -> ProductMemoryFact:
        clean = statement.strip()
        if not clean:
            raise ValueError("Provide a statement.")
        fact = ProductMemoryFact(
            product_id=product_id,
            category=normalize_category(category),
            statement=clean,
            # Typed by a human, so it needs no confirmation pass.
            confirmed=True,
        )
        self.db.add(fact)
        self.db.commit()
        self.db.refresh(fact)
        return fact

    def update_fact(
        self, fact: ProductMemoryFact, *, statement: str | None = None, confirmed: bool | None = None
    ) -> ProductMemoryFact:
        if statement is not None:
            clean = statement.strip()
            if not clean:
                raise ValueError("Provide a statement.")
            fact.statement = clean
        if confirmed is not None:
            fact.confirmed = confirmed
        self.db.commit()
        self.db.refresh(fact)
        return fact

    def archive_fact(self, fact: ProductMemoryFact) -> None:
        fact.status = "archived"
        self.db.commit()

    def touch_uses(self, fact_ids: list[str]) -> None:
        """Count injections, so facts that never help can be spotted later."""
        if not fact_ids:
            return
        (
            self.db.query(ProductMemoryFact)
            .filter(ProductMemoryFact.id.in_(fact_ids))
            .update({ProductMemoryFact.uses: ProductMemoryFact.uses + 1}, synchronize_session=False)
        )
        self.db.commit()

    def apply_ops(
        self, product_id: str, ops: list[dict[str, Any]], *, source_session_id: str | None = None
    ) -> None:
        """Apply the extraction diff. An op targeting a fact of another product is
        ignored rather than raising: a hallucinated id must not fail the session."""
        owned = {
            fact.id: fact
            for fact in self.db.execute(
                select(ProductMemoryFact).where(ProductMemoryFact.product_id == product_id)
            )
            .scalars()
            .all()
        }
        existing_statements = {
            fact.statement.strip().lower(): fact for fact in owned.values() if fact.status == "active"
        }

        for op in ops:
            action = str(op.get("action", "")).strip().lower()
            statement = (op.get("statement") or "").strip()
            fact = owned.get(op.get("id") or "")

            if action == "remove":
                if fact is not None:
                    fact.status = "archived"
                continue

            if action == "update":
                if fact is None or not statement:
                    continue
                fact.statement = statement
                fact.category = normalize_category(op.get("category", fact.category))
                fact.status = "active"
                # Rewritten by the model, so it needs a human pass again.
                fact.confirmed = False
                existing_statements[statement.lower()] = fact
                continue

            if action != "add" or not statement:
                continue
            duplicate = existing_statements.get(statement.lower())
            if duplicate is not None:
                continue
            created = ProductMemoryFact(
                product_id=product_id,
                category=normalize_category(op.get("category")),
                statement=statement,
                source_session_id=source_session_id,
            )
            self.db.add(created)
            existing_statements[statement.lower()] = created

        self.db.commit()

"""Contract of the product/memory endpoints — the surface the SPA depends on."""

from src.models.product_memory import ProductMemoryFact


def _create_product(client, name="Geofolia"):
    response = client.post("/api/products", json={"name": name})
    assert response.status_code == 200, response.text
    return response.json()


def test_products_start_empty(client):
    assert client.get("/api/products").json() == []


def test_create_product_is_idempotent_on_name(client):
    first = _create_product(client, "Geofolia")
    # Same product typed with another case must not split the memory in two.
    second = _create_product(client, "  geofolia  ")
    assert second["id"] == first["id"]
    assert len(client.get("/api/products").json()) == 1


def test_fact_count_reflects_active_facts_only(client):
    product = _create_product(client)
    created = client.post(
        f"/api/products/{product['id']}/memory",
        json={"category": "stack", "statement": "Backend .NET 8"},
    ).json()

    assert client.get("/api/products").json()[0]["factCount"] == 1

    assert client.delete(f"/api/memory/{created['id']}").status_code == 204
    assert client.get("/api/products").json()[0]["factCount"] == 0


def test_manual_fact_is_confirmed_and_categorized(client):
    product = _create_product(client)
    fact = client.post(
        f"/api/products/{product['id']}/memory",
        json={"category": "stack", "statement": "Backend .NET 8"},
    ).json()
    # Typed by a human: no confirmation pass needed.
    assert fact["confirmed"] is True
    assert fact["category"] == "stack"
    assert fact["sourceSessionId"] is None


def test_unknown_category_falls_back_instead_of_failing(client):
    product = _create_product(client)
    fact = client.post(
        f"/api/products/{product['id']}/memory",
        json={"category": "n_importe_quoi", "statement": "Un fait"},
    ).json()
    assert fact["category"] == "produit"


def test_correcting_a_statement_confirms_it(client, db):
    product = _create_product(client)
    stored = ProductMemoryFact(
        product_id=product["id"], category="stack", statement="Backend .NET 7"
    )
    db.add(stored)
    db.commit()
    assert stored.confirmed is False

    updated = client.patch(
        f"/api/memory/{stored.id}", json={"statement": "Backend .NET 8"}
    ).json()
    # Correcting IS vouching for the corrected version: it must not stay unverified.
    assert updated["statement"] == "Backend .NET 8"
    assert updated["confirmed"] is True


def test_confirm_without_editing(client, db):
    product = _create_product(client)
    stored = ProductMemoryFact(product_id=product["id"], category="stack", statement="Backend .NET")
    db.add(stored)
    db.commit()

    updated = client.patch(f"/api/memory/{stored.id}", json={"confirmed": True}).json()
    assert updated["confirmed"] is True
    assert updated["statement"] == "Backend .NET"


def test_empty_patch_is_rejected(client, db):
    product = _create_product(client)
    stored = ProductMemoryFact(product_id=product["id"], category="stack", statement="Backend")
    db.add(stored)
    db.commit()
    assert client.patch(f"/api/memory/{stored.id}", json={}).status_code == 400


def test_delete_archives_instead_of_erasing(client, db):
    product = _create_product(client)
    fact = client.post(
        f"/api/products/{product['id']}/memory", json={"statement": "Backend .NET"}
    ).json()

    assert client.delete(f"/api/memory/{fact['id']}").status_code == 204
    assert client.get(f"/api/products/{product['id']}/memory").json()["facts"] == []
    # Still on disk: a doubtful fact must remain traceable to its origin.
    assert db.query(ProductMemoryFact).filter_by(id=fact["id"]).one().status == "archived"


def test_deleting_a_product_takes_its_facts_with_it(client, db):
    product = _create_product(client)
    client.post(f"/api/products/{product['id']}/memory", json={"statement": "Backend .NET"})

    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get("/api/products").json() == []
    assert db.query(ProductMemoryFact).count() == 0


def test_unknown_ids_are_404(client):
    assert client.get("/api/products/nope/memory").status_code == 404
    assert client.post("/api/products/nope/memory", json={"statement": "x"}).status_code == 404
    assert client.patch("/api/memory/nope", json={"confirmed": True}).status_code == 404
    assert client.delete("/api/memory/nope").status_code == 404
    assert client.delete("/api/products/nope").status_code == 404


def test_blank_names_and_statements_are_rejected(client):
    product = _create_product(client)
    assert client.post("/api/products", json={"name": "   "}).status_code == 400
    assert (
        client.post(f"/api/products/{product['id']}/memory", json={"statement": "   "}).status_code
        == 400
    )


def test_starting_a_session_on_an_unknown_product_is_404(client, offline_llm):
    response = client.post(
        "/api/refinement/sessions",
        json={"objective": "Un sujet", "mode": "po", "productId": "does-not-exist"},
    )
    # 404, not 500: an unknown product is a missing resource, not a server fault.
    assert response.status_code == 404

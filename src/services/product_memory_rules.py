"""Offline heuristics deciding what deserves to enter the product memory.

Same role as ``detect_grid_by_keywords`` in :mod:`src.services.question_grids`: a
deterministic, network-free fallback the mock engine can rely on, and the place
where the durability rule is written once instead of being restated in prompts.
"""

from __future__ import annotations

import re

from src.models.product_memory import DEFAULT_MEMORY_CATEGORY

# A fact is durable if it would still be true in a *different* session about the same
# product. Anything anchored to a date, a sprint or a deadline is session-scoped.
_TEMPORAL_MARKERS = (
    "deadline", "d'ici", "d ici", "avant le", "cette semaine", "la semaine prochaine",
    "ce trimestre", "ce mois", "ce sprint", "sprint ", "demain", "aujourd'hui",
    "aujourd hui", "hier", "next week", "by the end", "this quarter", "asap",
    "en cours de", "pour le lancement", "livraison prévue", "livraison prevue",
)
_DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?|\d{4}-\d{2}-\d{2}|q[1-4]\s*20\d{2}|"
    r"janvier|février|fevrier|mars|avril|juin|juillet|août|aout|septembre|octobre|"
    r"novembre|décembre|decembre)\b",
    re.IGNORECASE,
)

# Ordered: the first category whose keywords match wins, so the more specific
# buckets are tested before the catch-all.
_CATEGORY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "stack",
        (
            "api", "backend", "frontend", "base de données", "base de donnees", "database",
            "sql", "postgres", "python", "java", ".net", "dotnet", "react", "angular",
            "node", "docker", "kubernetes", "azure", "aws", "gcp", "saml", "oauth", "sso",
            "endpoint", "framework", "langage", "serveur", "déploiement", "deploiement",
            "architecture", "microservice", "monolithe",
        ),
    ),
    (
        "equipe",
        (
            "équipe", "equipe", "développeur", "developpeur", "tech lead", "product owner",
            "responsable", "owner", "recrutement", "effectif", "maintenu par", "porté par",
            "porte par", "squad",
        ),
    ),
    (
        "contrainte",
        (
            "rgpd", "gdpr", "conformité", "conformite", "réglementaire", "reglementaire",
            "sécurité", "securite", "budget", "coût", "cout", "licence", "latence",
            "sla", "quota", "limite", "contrainte", "légal", "legal", "audit",
        ),
    ),
    (
        "utilisateur",
        (
            "utilisateur", "client", "cible", "persona", "segment", "marché", "marche",
            "adoption", "clientèle", "clientele", "usager",
        ),
    ),
    (
        "decision",
        (
            "décidé", "decide", "décision", "decision", "arbitrage", "retenu", "abandonné",
            "abandonne", "choix", "tranché", "tranche", "acté", "acte",
        ),
    ),
)

# A durable fact is a statement, not a paragraph. Beyond this it is session narrative.
_MAX_STATEMENT_LENGTH = 220


def is_durable_statement(text: str) -> bool:
    statement = (text or "").strip()
    if not statement or len(statement) > _MAX_STATEMENT_LENGTH:
        return False
    lowered = statement.lower()
    if any(marker in lowered for marker in _TEMPORAL_MARKERS):
        return False
    return _DATE_PATTERN.search(lowered) is None


def classify_memory_category(text: str) -> str:
    lowered = (text or "").lower()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return category
    return DEFAULT_MEMORY_CATEGORY

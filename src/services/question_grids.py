"""Question grids (postures) for generalist subject refinement.

Three explicit grids — PO, Technique, Hybride — plus an ``auto`` mode that resolves
to one of them. Each grid is a list of axes ``{key, label}`` used both as the
"Intent Structure" tree branches and as the guidance for question generation.
"""

from __future__ import annotations

# Requested mode (what the user picks at the prompt) vs resolved grid (a real posture).
MODES = ("po", "technique", "hybride", "auto")
GRIDS = ("po", "technique", "hybride")

GRID_LABELS: dict[str, str] = {
    "po": "PO",
    "technique": "Technique",
    "hybride": "Hybride",
}

GRID_AXES: dict[str, list[dict[str, str]]] = {
    "po": [
        {"key": "objectif", "label": "Objectif"},
        {"key": "cible", "label": "Cible / utilisateurs"},
        {"key": "probleme", "label": "Problème"},
        {"key": "valeur", "label": "Valeur / impact"},
        {"key": "perimetre", "label": "Périmètre"},
        {"key": "contraintes", "label": "Contraintes métier"},
        {"key": "succes", "label": "Critères de succès"},
        {"key": "dependances", "label": "Dépendances / parties prenantes"},
        {"key": "decision", "label": "Décision attendue"},
    ],
    "technique": [
        {"key": "comportement", "label": "Comportement attendu"},
        {"key": "cas_limites", "label": "Cas limites"},
        {"key": "integrations", "label": "Intégrations / APIs / services"},
        {"key": "contraintes_tech", "label": "Contraintes techniques"},
        {"key": "donnees", "label": "Données manipulées"},
        {"key": "risques_tech", "label": "Risques techniques"},
        {"key": "impacts", "label": "Impacts perf / sécurité / conformité / observabilité"},
        {"key": "dependances_tech", "label": "Dépendances / migrations"},
        {"key": "tests", "label": "Plan de test / validation"},
    ],
    "hybride": [
        {"key": "objectif_metier", "label": "Objectif métier"},
        {"key": "comportement", "label": "Comportement attendu"},
        {"key": "impactes", "label": "Qui est impacté"},
        {"key": "contraintes", "label": "Contraintes métier & techniques"},
        {"key": "arbitrages", "label": "Dépendances / risques / arbitrages"},
        {"key": "succes", "label": "Critères de succès (valeur + faisabilité)"},
        {"key": "incertitudes", "label": "Zones d'incertitude à trancher"},
    ],
}

# Keyword heuristics for the offline (mock) mode detection fallback.
_PO_KEYWORDS = (
    "priorité", "priorite", "valeur", "cible", "utilisateur", "impact", "besoin",
    "métier", "metier", "roi", "client", "adoption", "marché", "marche", "persona",
)
_TECH_KEYWORDS = (
    "api", "latence", "auth", "migration", "bug", "perf", "performance", "endpoint",
    "déploiement", "deploiement", "base de données", "database", "code", "service",
    "intégration", "integration", "sécurité", "securite", "cache", "sql", "schema",
)


def normalize_mode(mode: str | None) -> str:
    value = (mode or "auto").strip().lower()
    return value if value in MODES else "auto"


def resolve_grid(grid: str | None) -> str:
    value = (grid or "po").strip().lower()
    return value if value in GRIDS else "po"


def grid_axes(grid: str) -> list[dict[str, str]]:
    return GRID_AXES[resolve_grid(grid)]


def detect_grid_by_keywords(text: str) -> str:
    """Offline heuristic used by the mock engine to guess the best grid."""
    lowered = (text or "").lower()
    po = sum(1 for keyword in _PO_KEYWORDS if keyword in lowered)
    tech = sum(1 for keyword in _TECH_KEYWORDS if keyword in lowered)
    if po > 0 and tech > 0 and abs(po - tech) <= 1:
        return "hybride"
    if tech > po:
        return "technique"
    return "po"

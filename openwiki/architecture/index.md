# Fichiers

- [RefineMap — Vue d'ensemble de l'architecture système](overview.md) - Architecture de haut niveau de RefineMap, le tableau de décision pour les équipes produit et tech — SPA React, backend FastAPI, moteur de raffinement LangGraph, persistance SQLAlchemy/PostgreSQL, fournisseurs de LLM interchangeables et flux de requête à travers une session.
- [Le moteur de raffinement — workflow LangGraph et couche LLM](refinement-engine.md) - Le cœur différenciateur de RefineMap — la machine à états LangGraph (générer des questions, résumer le contexte, raffinement final, extraire la mémoire), ses règles de routage, la forme de RefinementState, et les deux moteurs LLM avec réparation JSON, nouvelle tentative et repli hors ligne.

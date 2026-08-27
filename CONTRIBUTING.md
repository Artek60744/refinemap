# Contribuer à RefineMap

Merci de l'intérêt. Ce projet est maintenu par une personne sur son temps libre :
les contributions ciblées et petites sont bien plus faciles à intégrer que les
grandes refontes.

## Démarrer

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pip install -e .          # installe la commande `refinemap`
pytest                    # doit être vert avant toute modification
```

Le fournisseur LLM par défaut est `mock` : la suite de tests et le produit
tournent entièrement hors ligne, sans clé d'API. C'est volontaire — aucun test ne
doit jamais atteindre un vrai fournisseur.

## Avant d'ouvrir une pull request

- `pytest` passe.
- Pour un changement du frontend : `cd frontend && npx tsc --noEmit`.
- Toute sortie du LLM passe par un modèle Pydantic en `extra="forbid"`
  (`src/api/schemas_refinement.py`). Un nouveau champ s'ajoute au schéma, pas au
  `dict` brut.
- Les prompts vivent dans `prompts/`. Les modifier change `prompt_version`, qui
  est enregistré sur chaque session — c'est voulu, ne le contourne pas.

## Périmètre du projet

RefineMap est un outil **local-first**. Ce qui est explicitement hors périmètre,
et sera refusé même bien implémenté :

- authentification, comptes, multi-tenant ;
- connecteurs Jira / Linear / Notion ;
- toute fonctionnalité qui suppose un service hébergé.

Le livrable est un fichier markdown dans ton dépôt. C'est le format d'intégration,
et il n'y en aura pas d'autre.

En revanche, sont très bienvenus : les fournisseurs LLM supplémentaires (surtout
locaux), les grilles de questions, les améliorations de la mémoire produit, les
traductions, et tout ce qui rend le CLI plus agréable.

## Documentation générée

`openwiki/` est **généré** — ne l'édite pas à la main. Modifie le code ou le
README, puis régénère :

```bash
npm install
npm run docs:update
```

Committe la régénération séparément de ton changement de code.

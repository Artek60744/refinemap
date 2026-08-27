---
type: Opérations
title: Déploiement, Docker et la VM Azure
description: Comment RefineMap est déployé sur sa VM Azure — le flux deploy.sh (sync en dev vs deploy en prod), les trois conteneurs Docker, le contrôle des coûts, ce qui n'est jamais écrasé, les canaux de transport et les limites de sécurité documentées.
tags: [operations, deployment, docker, azure, devops]
openwiki:
  roles: [operations]
  change_kinds: [delivery]
  source_paths: [deploy.sh, docker-compose.yml, docker-compose.dev.yml, Dockerfile, frontend/Dockerfile, frontend/nginx.conf]
  symbols: [deploy.sh]
  invariants: ["The VM .env is never touched by sync or deploy; only ./deploy.sh env writes it. requirements.txt, Dockerfile and docker-compose changes require ./deploy.sh deploy, not sync. The pgdata volume survives down/deploy/stop; only a manual docker compose down -v removes it."]
  validation_commands: [./deploy.sh status]
---

# Déploiement, Docker et la VM Azure

L'application s'exécute dans des conteneurs Docker sur une VM Azure, et toutes les opérations passent par `./deploy.sh` à la racine du dépôt (le `usage` du script liste toutes les sous-commandes). Cette page est le guide opérationnel : elle reprend les faits durables et les règles de sécurité des changements.

**Il n'y a plus de déploiement de référence.** L'ancienne VM de démonstration a été
supprimée : le produit est distribué comme outil local (CLI + application locale), pas
comme service hébergé. Cette page reste le guide pour qui veut héberger sa propre
instance — les identifiants de l'infrastructure cible se déclarent dans un `deploy.env`
local et non tracké (voir `deploy.env.example`).

## Conteneurs

| Conteneur | Image | Rôle |
|---|---|---|
| `web` | `frontend/Dockerfile` (node build -> nginx:alpine) | Sert la SPA construite (voir [frontend/overview.md](../frontend/overview.md)) et agit comme proxy inverse pour `/api` et `/health` vers `app`. Écoute sur le port 80. `proxy_read_timeout 300s` car l'aller-retour des réponses exécute le LLM de manière synchrone. Les fichiers `/assets/` hachés sont mis en cache de façon immuable ; le fallback SPA est `no-cache`. |
| `app` | `Dockerfile` (python:3.12-slim) | FastAPI + LangGraph, interne au réseau Docker, aucun port publié. Exécute `uvicorn src.main:app`. |
| `db` | `postgres:16-alpine` | PostgreSQL 16 avec un volume `pgdata` ; démarrage contrôlé par healthcheck. |

## La boucle quotidienne

```bash
./deploy.sh dev      # once: switch to hot-reload mode on the VM
# ... edit code ...
./deploy.sh sync     # copy code to the VM and apply it (dev mode: no rebuild)
./deploy.sh logs     # last 80 app lines; logs <n> | logs db | logs web | logs all | logs -f
./deploy.sh status   # containers, current mode, disk, memory
```

Deux modes, mémorisés sur la VM dans `.dev-mode` :

- **dev** — source montée depuis `/opt/refinement` dans le conteneur, `uvicorn --reload` (via `docker-compose.dev.yml`), mises à jour via `sync` (copie de fichiers uniquement). Le rechargement à chaud ne couvre que le backend ; l'itération frontend se fait localement avec Vite et `sync` reconstruit l'image `web` lorsque `frontend/` a changé (aucune opération sinon, grâce au cache Docker).
- **prod** — code copié dans l'image, mises à jour via `./deploy.sh deploy` (envoi, reconstruction, redémarrage). Utilisez `deploy` au lieu de `sync` dès que `requirements.txt`, le `Dockerfile` ou `docker-compose.yml` ont changé — ceux-ci ne sont pris en compte qu'à la construction de l'image.

Autres commandes : `restart`, `down` (arrêt des conteneurs, base de données préservée), `stop` / `start` (libérer / démarrer la VM pour maîtriser les coûts), `env [file]` (écrit le `.env` de la VM, avec sauvegarde de l'ancien dans `.env.bak`), `ssh`, `health`.

## Ce qui n'est jamais écrasé

- Le `.env` de la VM (configuration de production incluant une `SECRET_KEY` générée) — exclu de tous les transferts ; seul `./deploy.sh env` y touche, avec une copie `.env.bak`.
- Sont également exclus des synchronisations : `*.db`, `deploy.env`, `__pycache__`, `.git`, `.venv`, `logs/`.
- Le volume `pgdata` survit à `down`, `deploy` et `stop` ; seul un `docker compose down -v` manuel le supprime.
- La synchronisation est un miroir : un fichier supprimé localement disparaît de la VM à la prochaine `sync`.

## Transport et configuration

Deux canaux, sélectionnés automatiquement : **SSH** (rsync, rapide, diffuse les journaux ; nécessite la clé et un port 22 ouvert) et **Azure Run Command API** (base64 de l'archive source dans l'appel API ; fonctionne depuis des réseaux bloqués mais prend 1 à 2 minutes par synchronisation et plafonne à ~200 Ko de charge utile — `DEPLOY_TRANSPORT=ssh` force le canal rapide). Le script transmet explicitement l'abonnement à chaque appel `az`, car certains locataires d'entreprise réinitialisent l'abonnement CLI actif.

Aucune valeur par défaut n'est fournie : `deploy.sh` s'arrête s'il manque l'une des variables `AZ_SUBSCRIPTION`, `AZ_RESOURCE_GROUP`, `AZ_VM_NAME`, `AZ_VM_USER`, `AZ_VM_IP`, `AZ_SSH_KEY` ou `AZ_REMOTE_DIR`. Elles se déclarent dans un `deploy.env` local, non tracké — copier `deploy.env.example` pour démarrer. Seul `DEPLOY_TRANSPORT` a une valeur par défaut (`auto`).

## Contrôle des coûts

VM Standard_B2s (2 vCPU, 4 Go, Ubuntu 22.04) dans France Central ≈ 30 €/mois en fonctionnement continu sur un crédit d'environ 50 €/mois ; `./deploy.sh stop` pendant les nuits et les week-ends divise approximativement ce montant par trois. Le disque (~4 €/mois) et l'IP publique (~3 €/mois) sont facturés même à l'arrêt.

## Limites connues

- **Pas de HTTPS** — trafic en clair ; acceptable pour un outil de test interne, à corriger (Caddy + Let's Encrypt + domaine) avant toute utilisation réelle.
- **Pas d'authentification** — toute personne disposant de l'IP accède à l'application et à la page des paramètres.
- **Schéma initialisé par `create_all()`** + migration montante écrite à la main, et non Alembic (voir [data-model.md](../domain/data-model.md)).
- **Identifiants PostgreSQL par défaut** (`postgres`/`postgres`) — non exposés hors du réseau Docker, mais à durcir avec le reste.
- **Les déploiements s'exécutent depuis la station de travail locale**, pas depuis CI : ce qui part est votre copie de travail, y compris les modifications non validées.

## Guide des changements

- **Quand consulter cette page :** lors de modifications de la configuration Docker, de la config nginx, des ressources VM, ou lors d'un déploiement.
- **Invariants à préserver :** exclusion du `.env` des transferts ; sémantique du marqueur `.dev-mode` ; distinction `deploy` vs `sync` (les fichiers de construction nécessitent `deploy`) ; `proxy_read_timeout` reste élevé pour les cycles LLM synchrones ; conserver le fallback SPA et les règles de cache `/assets/` dans nginx.
- **Validation :** `./deploy.sh status` et `./deploy.sh health` après chaque changement ; test de fumée Docker local `docker compose up --build` avant de toucher à la VM. local `docker compose up --build` avant de toucher à la VM.
---
type: Operations
title: Deployment, Docker and the Azure VM
description: How RefineMap is deployed on its Azure VM — the deploy.sh workflow (dev sync vs prod deploy), the three Docker containers, cost control, what is never overwritten, transport channels, and the documented security limits.
tags: [operations, deployment, docker, azure, devops]
openwiki:
  roles: [operations]
  change_kinds: [delivery]
  source_paths: [deploy.sh, docker-compose.yml, docker-compose.dev.yml, Dockerfile, frontend/Dockerfile, frontend/nginx.conf]
  symbols: [deploy.sh]
  invariants: ["The VM .env is never touched by sync or deploy; only ./deploy.sh env writes it. requirements.txt, Dockerfile and docker-compose changes require ./deploy.sh deploy, not sync. The pgdata volume survives down/deploy/stop; only a manual docker compose down -v removes it."]
  validation_commands: [./deploy.sh status]
---

# Deployment, Docker and the Azure VM

The application runs in Docker containers on an Azure VM, and every operation goes
through `./deploy.sh` at the repository root. The full operational guide lives in
`docs/deployment.md`; this page captures the durable facts and the change-safety
rules.

**Production URL:** http://203.0.113.10/ (no HTTPS — see limits below).

## Containers

| Container | Image | Role |
|---|---|---|
| `web` | `frontend/Dockerfile` (node build -> nginx:alpine) | Serves the built SPA (see [frontend/overview.md](../frontend/overview.md)) and reverse-proxies `/api` and `/health` to `app`. Listens on port 80. `proxy_read_timeout 300s` because the answers round-trip runs the LLM synchronously. Hashed `/assets/` files are cached immutable; the SPA fallback is `no-cache`. |
| `app` | `Dockerfile` (python:3.12-slim) | FastAPI + LangGraph, internal to the Docker network, no published port. Runs `uvicorn src.main:app`. |
| `db` | `postgres:16-alpine` | PostgreSQL 16 with a `pgdata` volume; healthcheck-gated startup. |

## The daily loop

```bash
./deploy.sh dev      # once: switch to hot-reload mode on the VM
# ... edit code ...
./deploy.sh sync     # copy code to the VM and apply it (dev mode: no rebuild)
./deploy.sh logs     # last 80 app lines; logs <n> | logs db | logs web | logs all | logs -f
./deploy.sh status   # containers, current mode, disk, memory
```

Two modes, memorized on the VM in `.dev-mode`:

- **dev** — source mounted from `/opt/refinement` into the container, `uvicorn
  --reload` (via `docker-compose.dev.yml`), updates via `sync` (file copy only).
  Hot reload covers the backend only; frontend iteration happens locally with Vite
  and `sync` rebuilds the `web` image when `frontend/` changed (no-op otherwise,
  thanks to Docker cache).
- **prod** — code copied into the image, updates via `./deploy.sh deploy`
  (send, rebuild, restart). Use `deploy` instead of `sync` whenever
  `requirements.txt`, the `Dockerfile`, or `docker-compose.yml` changed — those are
  only honored at image build.

Other commands: `restart`, `down` (containers stop, database preserved), `stop` /
`start` (deallocate / start the VM to control cost), `env [file]` (write the VM
`.env`, backing up the old one to `.env.bak`), `ssh`, `health`.

## What is never overwritten

- The VM's `.env` (production config incl. a generated `SECRET_KEY`) — excluded from
  all transfers; only `./deploy.sh env` touches it, with a `.env.bak` copy.
- Also excluded from syncs: `*.db`, `deploy.env`, `__pycache__`, `.git`, `.venv`,
  `logs/`.
- The `pgdata` volume survives `down`, `deploy`, and `stop`; only a manual
  `docker compose down -v` deletes it.
- Sync is a mirror: a file deleted locally disappears from the VM on the next
  `sync`.

## Transport and configuration

Two channels, auto-selected: **SSH** (rsync, fast, streams logs; requires the key
and an open port 22) and **Azure Run Command API** (base64 of the source tarball in
the API call; works from blocked networks but takes 1–2 minutes per sync and has a
~200 KB payload ceiling — `DEPLOY_TRANSPORT=ssh` forces the fast channel). The
script passes the subscription explicitly on every `az` call because the l'entreprise
tenant keeps resetting the active CLI subscription.

Defaults (overridable via environment or a local `deploy.env`): `AZ_SUBSCRIPTION=
00000000-0000-0000-0000-000000000000`, `AZ_RESOURCE_GROUP=rg-example`,
`AZ_VM_NAME=vm-example`, `AZ_VM_IP=203.0.113.10`, `AZ_VM_USER=azureuser`,
`AZ_SSH_KEY=~/.ssh/deploy_key`, `AZ_REMOTE_DIR=/opt/refinement`,
`DEPLOY_TRANSPORT=auto`.

## Cost control

VM Standard_B2s (2 vCPU, 4 GB, Ubuntu 22.04) in France Central ≈ 30 €/month
running continuously out of a ~50 €/month credit; `./deploy.sh stop` during nights
and weekends roughly divides that by three. Disk (~4 €/month) and the public IP
(~3 €/month) are billed even while stopped.

## Known limits (documented in `docs/deployment.md`)

- **No HTTPS** — traffic in clear; acceptable for an internal test tool, to be
  fixed (Caddy + Let's Encrypt + domain) before any real use.
- **No authentication** — anyone with the IP reaches the app and the settings page.
- **Schema bootstrapped by `create_all()`** + hand-rolled forward migration, not
  Alembic (see [data-model.md](../domain/data-model.md)).
- **Default PostgreSQL credentials** (`postgres`/`postgres`) — not exposed outside
  the Docker network, but to harden alongside the rest.
- **Deployments run from the local workstation**, not CI: what ships is your
  working copy, including uncommitted changes.

## Change guidance

- **When to consult this page:** changing the Docker setup, nginx config, VM
  resources, or running a deployment.
- **Invariants to preserve:** `.env` exclusion from transfers; `.dev-mode` marker
  semantics; `deploy` vs `sync` split (build-time files require `deploy`);
  `proxy_read_timeout` stays high for synchronous LLM rounds; keep the SPA fallback
  and the `/assets/` cache rules in nginx.
- **Validation:** `./deploy.sh status` and `./deploy.sh health` after any change;
  local Docker smoke test `docker compose up --build` before touching the VM.

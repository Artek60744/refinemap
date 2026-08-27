#!/usr/bin/env bash
#
# Deploy / update the Refinement Assistant on its Azure VM.
# See openwiki/operations/deployment.md for the full guide.
#
set -euo pipefail

# ---------------------------------------------------------------- configuration
# Every value can be overridden from the environment or from a local deploy.env.
SUBSCRIPTION="${AZ_SUBSCRIPTION:-00000000-0000-0000-0000-000000000000}"
RESOURCE_GROUP="${AZ_RESOURCE_GROUP:-rg-example}"
VM_NAME="${AZ_VM_NAME:-vm-example}"
VM_USER="${AZ_VM_USER:-azureuser}"
VM_IP="${AZ_VM_IP:-203.0.113.10}"
SSH_KEY="${AZ_SSH_KEY:-$HOME/.ssh/deploy_key}"
REMOTE_DIR="${AZ_REMOTE_DIR:-/opt/refinement}"
# ssh | az | auto — "auto" prefers ssh and silently falls back to the Azure API.
TRANSPORT="${DEPLOY_TRANSPORT:-auto}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$PROJECT_DIR/deploy.env" ]] && source "$PROJECT_DIR/deploy.env"

# Files that live only on the server. rsync --delete leaves excluded paths
# alone, so listing them here is what stops a sync from wiping the server's
# .env or its mode marker.
REMOTE_ONLY=(
  --exclude='.env'
  --exclude='.env.bak'
  --exclude='.dev-mode'
)

# Files never shipped to the VM. The server keeps its own .env and its own
# database; overwriting either from a laptop would be a bad afternoon.
EXCLUDES=(
  "${REMOTE_ONLY[@]}"
  --exclude='deploy.env'
  --exclude='*.db'
  --exclude='__pycache__'
  --exclude='*.pyc'
  --exclude='.git'
  --exclude='.venv'
  --exclude='venv'
  --exclude='logs'
  --exclude='.pytest_cache'
  --exclude='.mypy_cache'
  --exclude='.ruff_cache'
  --exclude='frontend/node_modules'
  --exclude='frontend/dist'
)

# Azure's Run Command caps the inline script it accepts. Our payload is the
# base64 of the source tarball, so warn well before we hit the ceiling.
MAX_PAYLOAD_BYTES=200000

TMPFILES=()
cleanup() { [[ ${#TMPFILES[@]} -gt 0 ]] && rm -f "${TMPFILES[@]}"; return 0; }
trap cleanup EXIT
scratch() { local f; f="$(mktemp "$@")"; TMPFILES+=("$f"); echo "$f"; }

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'; DIM=$'\033[2m'; NC=$'\033[0m'
info()  { echo "${BLUE}==>${NC} $*"; }
ok()    { echo "${GREEN}  ok${NC} $*"; }
warn()  { echo "${YELLOW}  ! ${NC} $*"; }
die()   { echo "${RED}  ✗ ${NC} $*" >&2; exit 1; }

# ------------------------------------------------------------------- transport
# Two ways to reach the box, same interface. SSH is much faster and streams
# output; the Azure Run Command API works from networks that block port 22.
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new
          -o ConnectTimeout=8 -o LogLevel=ERROR)
RESOLVED_TRANSPORT=""

ssh_available() {
  [[ -f "$SSH_KEY" ]] || return 1
  ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$VM_USER@$VM_IP" true 2>/dev/null
}

resolve_transport() {
  [[ -n "$RESOLVED_TRANSPORT" ]] && return 0
  case "$TRANSPORT" in
    ssh) ssh_available || die "SSH to $VM_IP failed (key: $SSH_KEY)"
         RESOLVED_TRANSPORT=ssh ;;
    az)  RESOLVED_TRANSPORT=az ;;
    auto)
      if ssh_available; then
        RESOLVED_TRANSPORT=ssh
      else
        RESOLVED_TRANSPORT=az
        warn "SSH unreachable, using the Azure Run Command API (slower)"
      fi ;;
    *) die "DEPLOY_TRANSPORT must be ssh, az or auto (got: $TRANSPORT)" ;;
  esac
  echo "${DIM}    transport: $RESOLVED_TRANSPORT${NC}"
}

# Run a shell script (read from stdin) on the VM as root.
remote_run() {
  resolve_transport
  local script; script="$(cat)"
  if [[ "$RESOLVED_TRANSPORT" == "ssh" ]]; then
    ssh "${SSH_OPTS[@]}" "$VM_USER@$VM_IP" "sudo bash -s" <<< "$script"
  else
    local tmp; tmp="$(scratch)"
    printf '%s\n' "$script" > "$tmp"
    local size; size=$(wc -c < "$tmp")
    (( size > MAX_PAYLOAD_BYTES )) && die \
      "payload is ${size}B, over the ${MAX_PAYLOAD_BYTES}B Run Command budget — use SSH (DEPLOY_TRANSPORT=ssh)"
    az vm run-command invoke \
      --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" \
      --name "$VM_NAME" --command-id RunShellScript --scripts "@$tmp" \
      --output json \
      | python3 -c '
import json, sys
for v in json.load(sys.stdin)["value"]:
    msg = v.get("message", "")
    body = msg.split("[stdout]", 1)[-1]
    out, _, err = body.partition("[stderr]")
    print(out.strip())
    if err.strip():
        print(err.strip(), file=sys.stderr)
'
  fi
}

# ----------------------------------------------------------------- code upload
# Ship the working tree to $REMOTE_DIR, mirroring deletions but preserving the
# server-side .env. rsync over SSH when we can; a base64 tarball otherwise.
push_code() {
  resolve_transport
  info "Uploading source"
  if [[ "$RESOLVED_TRANSPORT" == "ssh" ]]; then
    rsync -az --delete "${EXCLUDES[@]}" \
      -e "ssh ${SSH_OPTS[*]}" --rsync-path="sudo rsync" \
      "$PROJECT_DIR/" "$VM_USER@$VM_IP:$REMOTE_DIR/"
  else
    local tarball; tarball="$(scratch --suffix=.tar.gz)"
    local script;  script="$(scratch)"
    tar "${EXCLUDES[@]}" -czf "$tarball" -C "$PROJECT_DIR" .
    {
      echo 'set -e'
      echo 'rm -rf /tmp/refdeploy && mkdir -p /tmp/refdeploy'
      echo "cat > /tmp/ref_b64.txt << 'EOF_PAYLOAD'"
      base64 -w0 "$tarball"; echo
      echo 'EOF_PAYLOAD'
      echo 'base64 -d /tmp/ref_b64.txt > /tmp/ref.tar.gz'
      echo 'tar xzf /tmp/ref.tar.gz -C /tmp/refdeploy'
      echo "mkdir -p $REMOTE_DIR"
      # --delete keeps the VM honest about removed files; server-only paths stay.
      echo "rsync -a --delete ${REMOTE_ONLY[*]} /tmp/refdeploy/ $REMOTE_DIR/"
      echo "chown -R $VM_USER:$VM_USER $REMOTE_DIR"
      echo 'rm -rf /tmp/refdeploy /tmp/ref_b64.txt /tmp/ref.tar.gz'
    } > "$script"
    remote_run < "$script"
  fi
  ok "source synced to $REMOTE_DIR"
}

# ---------------------------------------------------------------- compose mode
# Dev mode adds docker-compose.dev.yml (bind-mounted source + uvicorn --reload).
# The marker file lets every later command pick the same overlay back up.
MARKER="$REMOTE_DIR/.dev-mode"
compose_cmd() {
  cat <<EOF
cd $REMOTE_DIR
if [ -f $MARKER ]; then
  COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
else
  COMPOSE="docker compose"
fi
EOF
}

# ---------------------------------------------------------------- app commands
cmd_deploy() {
  push_code
  info "Rebuilding and restarting containers"
  remote_run <<EOF
$(compose_cmd)
\$COMPOSE up -d --build
sleep 4
\$COMPOSE ps
EOF
  ok "deployed"
  cmd_health
}

cmd_sync() {
  push_code
  remote_run <<EOF
$(compose_cmd)
# Rebuild the SPA image; docker layer cache makes this a no-op when frontend/
# did not change.
\$COMPOSE up -d --build web
if [ -f $MARKER ]; then
  echo "dev mode: uvicorn --reload picks the Python changes up on its own"
else
  echo "prod mode: restarting the app container"
  \$COMPOSE restart app
fi
EOF
  ok "synced"
  cmd_health
}

cmd_dev() {
  info "Switching the VM to dev mode (bind-mounted source, hot reload)"
  push_code
  remote_run <<EOF
touch $MARKER
$(compose_cmd)
\$COMPOSE up -d --build
sleep 4
\$COMPOSE ps
EOF
  ok "dev mode on — use './deploy.sh sync' for fast iterations"
}

cmd_prod() {
  info "Switching the VM back to prod mode (code baked into the image)"
  remote_run <<EOF
rm -f $MARKER
cd $REMOTE_DIR
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose up -d --build
sleep 4
docker compose ps
EOF
  ok "prod mode on"
}

# logs [-f] [N] [service] — defaults to the app service, since the database
# chatters constantly and is rarely what you are debugging. Pass "all" for both.
cmd_logs() {
  local follow="" tail=80 service=app
  for arg in "$@"; do
    case "$arg" in
      -f|--follow) follow="-f" ;;
      all)         service="" ;;
      app|db|web)  service="$arg" ;;
      ''|*[!0-9]*) ;;
      *)           tail="$arg" ;;
    esac
  done
  if [[ -n "$follow" ]]; then
    resolve_transport
    [[ "$RESOLVED_TRANSPORT" == "az" ]] && \
      die "log streaming needs SSH; without it use './deploy.sh logs' for a snapshot"
    ssh -t "${SSH_OPTS[@]}" "$VM_USER@$VM_IP" \
      "cd $REMOTE_DIR && sudo docker compose logs -f --tail=$tail $service"
  else
    remote_run <<EOF
$(compose_cmd)
\$COMPOSE logs --tail=$tail $service
EOF
  fi
}

cmd_status() {
  remote_run <<EOF
$(compose_cmd)
echo "mode:  \$([ -f $MARKER ] && echo dev || echo prod)"
echo
\$COMPOSE ps
echo
echo "--- disk ---"
df -h / | tail -1
echo "--- memory ---"
free -h | head -2
EOF
}

cmd_restart() {
  remote_run <<EOF
$(compose_cmd)
\$COMPOSE restart
sleep 4
\$COMPOSE ps
EOF
  ok "restarted"
  cmd_health
}

cmd_down() {
  remote_run <<EOF
$(compose_cmd)
\$COMPOSE down
EOF
  ok "containers stopped (the database volume is untouched)"
}

# Push a local env file to the VM. Deliberately explicit: .env is excluded from
# every sync, so secrets only ever move when you ask for it by name.
cmd_env() {
  local src="${1:-$PROJECT_DIR/.env.production}"
  [[ -f "$src" ]] || die "no env file at $src (pass one: ./deploy.sh env path/to/file)"
  info "Pushing $(basename "$src") to $REMOTE_DIR/.env"
  {
    echo 'set -e'
    echo "cp $REMOTE_DIR/.env $REMOTE_DIR/.env.bak 2>/dev/null || true"
    echo "cat > $REMOTE_DIR/.env << 'EOF_ENVFILE'"
    cat "$src"
    echo 'EOF_ENVFILE'
    echo "chown $VM_USER:$VM_USER $REMOTE_DIR/.env && chmod 600 $REMOTE_DIR/.env"
    echo 'echo "env written (previous version saved as .env.bak)"'
  } | remote_run
  warn "run './deploy.sh restart' to apply it"
}

cmd_health() {
  remote_run <<'EOF'
# Goes through nginx, so one check exercises the SPA proxy and the API at once.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost/health || echo 000)
if [ "$code" = "200" ]; then
  echo "health: HTTP $code — the app is serving"
else
  echo "health: HTTP $code — check './deploy.sh logs'"
fi
EOF
  echo "${DIM}    http://$VM_IP/${NC}"
}

cmd_ssh() {
  info "Opening a shell on $VM_NAME"
  ssh "${SSH_OPTS[@]}" -t "$VM_USER@$VM_IP" "cd $REMOTE_DIR && exec bash -l"
}

cmd_start_vm() {
  info "Starting the VM"
  az vm start --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" \
    --name "$VM_NAME" --output none
  ok "VM running (containers restart on their own)"
}

cmd_stop_vm() {
  info "Deallocating the VM (compute billing stops, disk billing continues)"
  az vm deallocate --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" \
    --name "$VM_NAME" --output none
  ok "VM deallocated — './deploy.sh start' brings it back"
}

usage() {
  cat <<EOF
Refinement Assistant — deployment helper

Usage: ./deploy.sh <command> [args]

Daily loop
  sync              Upload the code and apply it (fast; instant in dev mode)
                    Frontend changes rebuild the web image on the VM.
  dev               Switch the VM to dev mode: bind-mounted source, hot reload
                    (Python only — iterate on the frontend locally with Vite)
  logs [-f|N]       Show logs; -f follows (needs SSH), N sets the tail length
  status            Containers, current mode, disk and memory

Full deploys
  deploy            Upload, rebuild the image, restart          [default]
  prod              Leave dev mode; bake the code into the image again
  restart           Restart the containers
  down              Stop the containers (keeps the database volume)

Configuration
  env [file]        Push an env file to the VM (default: .env.production)
  ssh               Open a shell on the VM
  health            Check that the app answers

Cost control
  stop              Deallocate the VM (stops compute billing)
  start             Start it again

Transport is picked automatically: SSH when port 22 is reachable, otherwise the
Azure Run Command API. Force it with DEPLOY_TRANSPORT=ssh|az.
EOF
}

case "${1:-deploy}" in
  deploy)          cmd_deploy ;;
  sync|push)       cmd_sync ;;
  dev)             cmd_dev ;;
  prod)            cmd_prod ;;
  logs|log)        shift; cmd_logs "${@:-}" ;;
  status|ps)       cmd_status ;;
  restart)         cmd_restart ;;
  down|stop-app)   cmd_down ;;
  env)             shift; cmd_env "${@:-}" ;;
  health)          cmd_health ;;
  ssh|shell)       cmd_ssh ;;
  start|start-vm)  cmd_start_vm ;;
  stop|stop-vm)    cmd_stop_vm ;;
  -h|--help|help)  usage ;;
  *)               echo "Unknown command: $1"; echo; usage; exit 1 ;;
esac

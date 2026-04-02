#!/usr/bin/env bash
# Start/stop backend + frontend locally (no Docker).
# Usage:
#   ./scripts/start-local-app.sh start
#   ./scripts/start-local-app.sh stop

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
PID_FILE="$ROOT/.local-app.pids"
LOG_DIR="$ROOT/.logs"

DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5432/local}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
UI_HOST="${UI_HOST:-127.0.0.1}"
UI_PORT="${UI_PORT:-5173}"

cmd="${1:-start}"
mkdir -p "$LOG_DIR"

if [ "$cmd" = "stop" ]; then
  if [ ! -f "$PID_FILE" ]; then
    echo "Nothing to stop."
    exit 0
  fi

  echo "Stopping processes..."
  while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped PID $pid"
    fi
  done <"$PID_FILE"
  rm -f "$PID_FILE"
  exit 0
fi

if [ "$cmd" != "start" ]; then
  echo "Usage: $0 [start|stop]"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  echo "Already running (found $PID_FILE). Run: $0 stop"
  exit 1
fi

# Basic prerequisites
command -v python3 >/dev/null 2>&1 || { echo "Missing command: python3"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Missing command: npm"; exit 1; }

# Backend setup
if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "Creating backend venv..."
  (cd "$BACKEND_DIR" && python3 -m venv .venv)
fi

(
  cd "$BACKEND_DIR"
  # shellcheck source=/dev/null
  source .venv/bin/activate
  pip install -q -r requirements.txt
  export DATABASE_URL REDIS_URL
  exec uvicorn app.main:app --host "$API_HOST" --port "$API_PORT"
) >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Frontend setup
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host "$UI_HOST" --port "$UI_PORT"
) >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

printf '%s\n%s\n' "$BACKEND_PID" "$FRONTEND_PID" >"$PID_FILE"

echo ""
echo "Lead Lens running locally:"
echo "  API:  http://${API_HOST}:${API_PORT}"
echo "  UI:   http://${UI_HOST}:${UI_PORT}"
echo "  Logs: $LOG_DIR/backend.log, $LOG_DIR/frontend.log"

#!/usr/bin/env bash
# Start SokoSense: FastAPI backend (:8000) + TanStack frontend (:8081)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT=8000
FRONTEND_PORT=8081

# Stop any process listening on the given TCP port so dev can restart cleanly.
free_port() {
  local port="$1"
  local pids=""

  if command -v fuser &>/dev/null; then
    if fuser "${port}/tcp" &>/dev/null; then
      echo "Port ${port} in use — stopping existing process…"
      fuser -k "${port}/tcp" &>/dev/null || true
      sleep 0.5
      return
    fi
  fi

  if command -v lsof &>/dev/null; then
    pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Port ${port} in use — stopping existing process…"
      kill $pids 2>/dev/null || true
      sleep 0.5
      pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
      [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
      sleep 0.5
    fi
  fi
}

if [[ ! -d .venv ]]; then
  echo "Creating Python venv…"
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

free_port "$BACKEND_PORT"
echo "Starting FastAPI on http://127.0.0.1:${BACKEND_PORT} …"
uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

free_port "$FRONTEND_PORT"
echo "Starting frontend on http://127.0.0.1:${FRONTEND_PORT} …"
cd frontend
npm install --silent 2>/dev/null || npm install
npm run dev

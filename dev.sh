#!/usr/bin/env bash
# Levanta backend (uvicorn --reload :8000) + frontend (devserver.py :5600) juntos.
# Ctrl+C mata los dos.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Matar ocupantes previos
kill $(lsof -ti :8000) 2>/dev/null || true
kill $(lsof -ti :5600) 2>/dev/null || true

# Backend
cd "$ROOT/backend"
.venv/bin/uvicorn main:app --reload --port 8000 &
BE_PID=$!

# Frontend
cd "$ROOT"
python3 frontend/devserver.py 5600 &
FE_PID=$!

echo ""
echo "  backend  → http://127.0.0.1:8000/docs"
echo "  frontend → http://127.0.0.1:5600/map.html"
echo ""
echo "  Ctrl+C para parar todo."
echo ""

trap "kill $BE_PID $FE_PID 2>/dev/null" EXIT INT TERM
wait

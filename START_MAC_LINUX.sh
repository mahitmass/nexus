#!/bin/bash
set -e

echo ""
echo " ===================================="
echo "  PrahaariNet - Starting up..."
echo " ===================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo " ERROR: backend/.env not found!"
  echo " Run this first:"
  echo "   cp backend/.env.example backend/.env"
  echo " Then fill in your Neo4j credentials."
  echo ""
  exit 1
fi

# Kill any old instances
pkill -f "python main.py" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo " Starting backend on http://localhost:8000 ..."
cd "$SCRIPT_DIR/backend"
python3 main.py &
BACKEND_PID=$!
sleep 4

echo " Starting frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 6

echo " Opening browser..."
if command -v open &>/dev/null; then
  open http://localhost:3000       # Mac
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000   # Linux
fi

echo ""
echo " PrahaariNet is running!"
echo " Backend  → http://localhost:8000"
echo " Frontend → http://localhost:3000"
echo ""
echo " Press Ctrl+C to stop everything."

# Wait and clean up on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo ' Stopped.'" EXIT
wait

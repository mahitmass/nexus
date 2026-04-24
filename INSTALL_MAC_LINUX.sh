#!/bin/bash
set -e

echo ""
echo " ===================================="
echo "  PrahaariNet - First Time Setup"
echo "  Run this ONCE before anything else"
echo " ===================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo " Step 1: Installing Python packages..."
cd "$SCRIPT_DIR/backend"
pip3 install -r requirements.txt

echo ""
echo " Step 2: Installing Node packages..."
cd "$SCRIPT_DIR/frontend"
npm install

echo ""
echo " Step 3: Creating your .env file..."
cd "$SCRIPT_DIR/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  echo " Created backend/.env"
  echo ""
  echo " *** ACTION REQUIRED ***"
  echo " Open backend/.env in a text editor and fill in:"
  echo "   NEO4J_URI      (from console.neo4j.io)"
  echo "   NEO4J_PASSWORD (from your Aura credentials file)"
  echo ""
  # Try to open in default editor
  if command -v open &>/dev/null; then
    open -e backend/.env 2>/dev/null || nano backend/.env
  else
    nano backend/.env
  fi
else
  echo " backend/.env already exists, skipping."
fi

echo ""
echo " ===================================="
echo "  Setup complete!"
echo "  Now run: bash START_MAC_LINUX.sh"
echo " ===================================="

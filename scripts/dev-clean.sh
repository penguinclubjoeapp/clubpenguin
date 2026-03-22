#!/usr/bin/env bash
# scripts/dev-clean.sh — Remove everything the dev environment installed
set -e

cd "$(dirname "$0")/.."

echo "[clean] Stopping dev services..."
docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true

echo "[clean] Removing node_modules..."
rm -rf yukon-server/node_modules
rm -rf yukon/node_modules
rm -rf scripts/node_modules

echo "[clean] Removing client build artifacts..."
rm -rf yukon/dist
rm -rf yukon/assets/scripts/client/yukon.bundle.js
rm -rf yukon/assets/scripts/client/*.bundle.js

echo "[clean] Done. Dev environment fully removed."
echo "  To set up again: bash scripts/setup-dev.sh"

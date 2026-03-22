#!/usr/bin/env bash
# scripts/rebuild.sh - Build yukon client and restart services
set -e

cd "$(dirname "$0")/.."

echo "[rebuild] Building yukon client..."
cd yukon && npm run build && cd ..

echo "[rebuild] Rebuilding and restarting services..."
docker compose up -d --build yukon-server discord-bot yukon-client

echo "[rebuild] Done!"

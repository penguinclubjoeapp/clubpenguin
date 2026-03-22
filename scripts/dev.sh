#!/usr/bin/env bash
# scripts/dev.sh — Start local dev environment
# MySQL on :3307 (isolated from prod), server with babel-watch, client with webpack HMR
set -e

cd "$(dirname "$0")/.."

cleanup() {
    echo ""
    echo "[dev] Shutting down..."
    kill $SERVER_PID 2>/dev/null || true
    docker compose -f docker-compose.dev.yml down
    echo "[dev] Done."
}
trap cleanup EXIT INT TERM

# Install dependencies if needed
if [ ! -d "yukon-server/node_modules" ]; then
    echo "[dev] Installing server dependencies..."
    cd yukon-server && npm install && cd ..
fi

if [ ! -d "yukon/node_modules" ]; then
    echo "[dev] Installing client dependencies..."
    cd yukon && npm install && cd ..
fi

# Start dev MySQL
echo "[dev] Starting dev MySQL on port 3307..."
docker compose -f docker-compose.dev.yml up -d

echo "[dev] Waiting for MySQL..."
until docker compose -f docker-compose.dev.yml exec -T mysql-dev mysqladmin ping -h localhost --silent 2>/dev/null; do
    sleep 1
done
echo "[dev] MySQL ready."

# Start server with babel-watch (background)
echo "[dev] Starting yukon-server (babel-watch)..."
cd yukon-server && npm run dev &
SERVER_PID=$!
cd ..

# Give server a moment to bind ports
sleep 2

# Start client with webpack dev server (foreground)
echo "[dev] Starting yukon client on http://localhost:8080..."
cd yukon && npm run dev

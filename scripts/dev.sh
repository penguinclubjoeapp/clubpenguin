#!/usr/bin/env bash
# scripts/dev.sh — Start local dev environment
# Auto-detects free ports if defaults are in use.
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Port detection ────────────────────────────────────────────────────────────
find_port() {
    local port=$1 offset=1000
    while ss -tlnp 2>/dev/null | grep -q ":${port} " || lsof -iTCP:$port -sTCP:LISTEN &>/dev/null 2>&1; do
        echo "[dev] Port $port in use, trying $((port + offset))..." >&2
        port=$((port + offset))
    done
    echo $port
}

export DEV_MYSQL_PORT=$(find_port 3307)
export DEV_LOGIN_PORT=$(find_port 6112)
export DEV_WORLD_PORT=$(find_port 6113)
export DEV_CLIENT_PORT=$(find_port 8080)

echo "[dev] Ports:"
echo "  MySQL ........... :$DEV_MYSQL_PORT"
echo "  Login server .... :$DEV_LOGIN_PORT"
echo "  Game server ..... :$DEV_WORLD_PORT"
echo "  Client .......... http://localhost:$DEV_CLIENT_PORT"
echo ""

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "[dev] Shutting down..."
    kill $SERVER_PID 2>/dev/null || true
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.dev.yml down
    echo "[dev] Done."
}
trap cleanup EXIT INT TERM

# ── Install dependencies if needed ────────────────────────────────────────────
if [ ! -d "yukon-server/node_modules" ]; then
    echo "[dev] Installing server dependencies..."
    cd yukon-server && npm install && cd ..
fi

if [ ! -d "yukon/node_modules" ]; then
    echo "[dev] Installing client dependencies..."
    cd yukon && npm install && cd ..
fi

# ── Start dev MySQL ───────────────────────────────────────────────────────────
echo "[dev] Starting dev MySQL on port $DEV_MYSQL_PORT..."
docker compose -f docker-compose.dev.yml up -d

echo "[dev] Waiting for MySQL..."
until docker compose -f docker-compose.dev.yml exec -T mysql-dev mysqladmin ping -h localhost --silent 2>/dev/null; do
    sleep 1
done
echo "[dev] MySQL ready."

# ── Generate Prisma client (if needed) ────────────────────────────────────────
if [ ! -d "$PROJECT_ROOT/yukon-server/src/generated/prisma" ]; then
    echo "[dev] Generating Prisma client..."
    cd "$PROJECT_ROOT/yukon-server"
    DATABASE_URL="mysql://penguin:devpassword@127.0.0.1:${DEV_MYSQL_PORT}/yukon" npx prisma generate
fi

# ── Start server with nodemon (background) ───────────────────────────────────
echo "[dev] Starting yukon-server (nodemon + ts-node)..."
cd "$PROJECT_ROOT/yukon-server" && npm run dev &
SERVER_PID=$!

# Give server a moment to bind ports
sleep 2

# ── Start client with webpack dev server (foreground) ─────────────────────────
echo "[dev] Starting yukon client on http://localhost:$DEV_CLIENT_PORT..."
cd "$PROJECT_ROOT/yukon" && npm run dev

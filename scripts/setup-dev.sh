#!/usr/bin/env bash
# scripts/setup-dev.sh — First-time dev environment setup wizard
#
# Usage: bash scripts/setup-dev.sh
#
# A 7-step interactive wizard that takes a fresh git clone to a working
# local dev environment. Works on Linux, macOS, and Windows (WSL2).
# Safe to re-run — detects completed steps and offers to skip them.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOTAL_STEPS=7

# ── Colors & Helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC} $*"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*"; }
warn()  { echo -e "${YELLOW}  !${NC} $*"; }
err()   { echo -e "${RED}  ✗${NC} $*" >&2; }
hr()    { echo -e "${DIM}$(printf '─%.0s' {1..60})${NC}"; }

header() {
    local num=$1; shift
    echo ""
    echo ""
    echo -e "${CYAN}${BOLD}[$num/$TOTAL_STEPS] $*${NC}"
    hr
}

confirm() {
    local prompt="${1:-Press Enter to continue}"
    echo ""
    read -rp "$(echo -e "${DIM}$prompt [Enter=continue / s=skip]:${NC} ")" choice
    [[ "$choice" =~ ^[Ss]$ ]] && return 1
    return 0
}

pause() {
    local prompt="${1:-Press Enter to continue}"
    echo ""
    read -rp "$(echo -e "${DIM}$prompt [Enter]:${NC} ")" _
}

detect_os() {
    if [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
    elif [[ "$(uname)" == "Darwin" ]]; then
        echo "mac"
    else
        echo "linux"
    fi
}

OS=$(detect_os)

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: Prerequisites
# ═══════════════════════════════════════════════════════════════════════════════
step_01() {
    header 1 "Prerequisites"

    local missing=0

    # Node.js
    if command -v node &>/dev/null; then
        local node_ver
        node_ver=$(node -v | sed 's/v//')
        local node_major
        node_major=$(echo "$node_ver" | cut -d. -f1)
        if (( node_major >= 20 && node_major < 25 )); then
            ok "Node.js $node_ver"
        elif (( node_major >= 25 )); then
            err "Node.js $node_ver — v25+ is incompatible (SlowBuffer removed)"
            echo "  Use nvm: nvm install 20 && nvm use 20"
            missing=1
        else
            err "Node.js $node_ver found — need v20-24"
            missing=1
        fi
    else
        err "Node.js not found"
        missing=1
    fi

    # npm
    if command -v npm &>/dev/null; then
        ok "npm $(npm -v)"
    else
        err "npm not found"
        missing=1
    fi

    # Docker
    if command -v docker &>/dev/null; then
        ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
    else
        err "Docker not found"
        missing=1
    fi

    # Docker Compose
    if docker compose version &>/dev/null; then
        ok "Docker Compose (plugin)"
    elif command -v docker-compose &>/dev/null; then
        ok "docker-compose (standalone)"
    else
        err "Docker Compose not found"
        missing=1
    fi

    # git
    if command -v git &>/dev/null; then
        ok "git $(git --version | awk '{print $3}')"
    else
        err "git not found"
        missing=1
    fi

    if (( missing )); then
        echo ""
        warn "Some prerequisites are missing. Install them first:"
        echo ""
        case $OS in
            linux)
                echo "  Ubuntu/Debian:  sudo apt install nodejs npm docker.io docker-compose-plugin git"
                echo "  Arch:           sudo pacman -S nodejs npm docker docker-compose git"
                echo "  Fedora:         sudo dnf install nodejs npm docker docker-compose-plugin git"
                ;;
            mac)
                echo "  brew install node@20 docker git"
                echo "  Then open Docker Desktop to start the Docker daemon."
                ;;
            wsl)
                echo "  1. Install Docker Desktop for Windows with WSL2 backend"
                echo "  2. Inside WSL:  sudo apt install nodejs npm git"
                echo "  3. Make sure Docker Desktop's 'Use WSL 2 based engine' is on"
                ;;
        esac
        echo ""
        err "Fix the above and re-run this script."
        exit 1
    fi

    # Docker daemon running?
    if ! docker info &>/dev/null; then
        err "Docker is installed but the daemon isn't running."
        case $OS in
            linux) echo "  Try: sudo systemctl start docker" ;;
            mac)   echo "  Open Docker Desktop." ;;
            wsl)   echo "  Open Docker Desktop on Windows and ensure WSL integration is enabled." ;;
        esac
        exit 1
    fi
    ok "Docker daemon running"

    ok "All prerequisites met!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Install Dependencies
# ═══════════════════════════════════════════════════════════════════════════════
step_02() {
    header 2 "Install Dependencies"

    # Server
    if [ -d "$PROJECT_ROOT/yukon-server/node_modules" ]; then
        ok "yukon-server/node_modules already exists"
        if ! confirm "Re-install?"; then
            info "Skipping server deps."
        else
            info "Installing yukon-server dependencies..."
            cd "$PROJECT_ROOT/yukon-server" && npm install
            ok "yukon-server dependencies installed"
        fi
    else
        info "Installing yukon-server dependencies..."
        cd "$PROJECT_ROOT/yukon-server" && npm install
        ok "yukon-server dependencies installed"
    fi

    # Check bcrypt built correctly (common failure on Mac M1)
    if ! node -e "require('$PROJECT_ROOT/yukon-server/node_modules/bcrypt')" 2>/dev/null; then
        warn "bcrypt native module failed to build."
        echo "  This is common on Apple Silicon. Try:"
        echo "    cd yukon-server && npm rebuild bcrypt --build-from-source"
        pause "Fix bcrypt, then press Enter"
    else
        ok "bcrypt native module OK"
    fi

    # Client
    if [ -d "$PROJECT_ROOT/yukon/node_modules" ]; then
        ok "yukon/node_modules already exists"
        if ! confirm "Re-install?"; then
            info "Skipping client deps."
        else
            info "Installing yukon client dependencies..."
            cd "$PROJECT_ROOT/yukon" && npm install
            ok "yukon client dependencies installed"
        fi
    else
        info "Installing yukon client dependencies..."
        cd "$PROJECT_ROOT/yukon" && npm install
        ok "yukon client dependencies installed"
    fi

    # Verify script deps
    if [ ! -d "$PROJECT_ROOT/scripts/node_modules" ]; then
        info "Installing scripts dependencies (mysql2 for verify tool)..."
        cd "$PROJECT_ROOT/scripts" && npm install
    fi
    ok "All dependencies installed"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: Start Dev Database
# ═══════════════════════════════════════════════════════════════════════════════
step_03() {
    header 3 "Start Dev Database"

    # Check if dev MySQL is already running
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'clubpenguin-mysql-dev'; then
        ok "Dev MySQL already running on port 3307"
        if ! confirm "Recreate?"; then
            return
        fi
    fi

    # Check port 3307
    if ss -tlnp 2>/dev/null | grep -q ':3307 ' || lsof -iTCP:3307 -sTCP:LISTEN &>/dev/null; then
        warn "Port 3307 is in use. Stop the process using it or change the port in docker-compose.dev.yml"
        pause "Press Enter once port 3307 is free"
    fi

    info "Starting dev MySQL on port 3307..."
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.dev.yml up -d

    info "Waiting for MySQL to be ready..."
    local retries=30
    while (( retries > 0 )); do
        if docker compose -f docker-compose.dev.yml exec -T mysql-dev mysqladmin ping -h localhost --silent 2>/dev/null; then
            break
        fi
        sleep 1
        (( retries-- ))
    done

    if (( retries == 0 )); then
        err "MySQL failed to start. Check: docker logs clubpenguin-mysql-dev"
        exit 1
    fi
    ok "Dev MySQL ready"

    # Verify schema
    if docker compose -f docker-compose.dev.yml exec -T mysql-dev \
        mysql -u penguin -pdevpassword yukon -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yukon'" 2>/dev/null | grep -q '[0-9]'; then
        ok "Schema loaded"
    else
        warn "Schema may not be loaded yet (first-time init can take a moment)"
        info "If tables are missing, try: docker compose -f docker-compose.dev.yml down -v && re-run this step"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: Create Dev Account
# ═══════════════════════════════════════════════════════════════════════════════
step_04() {
    header 4 "Create Dev Account"

    info "Create a penguin account for testing."
    echo "  (4-12 characters, letters/numbers/spaces)"
    echo ""

    read -rp "  Username: " dev_username
    if [ -z "$dev_username" ]; then
        warn "Skipping account creation."
        return
    fi

    read -rsp "  Password: " dev_password
    echo ""

    if [ -z "$dev_password" ]; then
        err "Password cannot be empty."
        return
    fi

    # Hash password and insert via the verify script's mysql2 connection
    # We'll use a small inline node script
    info "Creating account..."
    cd "$PROJECT_ROOT"
    node -e "
const path = require('path');
const bcrypt = require(path.join('$PROJECT_ROOT', 'yukon-server', 'node_modules', 'bcrypt'));
const mysql = require(path.join('$PROJECT_ROOT', 'scripts', 'node_modules', 'mysql2', 'promise'));

(async () => {
    const hash = await bcrypt.hash('$dev_password', 10);
    const conn = await mysql.createConnection({
        host: '127.0.0.1', port: 3307,
        user: 'penguin', password: 'devpassword', database: 'yukon'
    });

    try {
        await conn.execute(
            'INSERT INTO users (username, password, member) VALUES (?, ?, 1)',
            ['$dev_username', hash]
        );
        console.log('OK');
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            console.log('EXISTS');
        } else {
            throw e;
        }
    } finally {
        await conn.end();
    }
})();
" 2>/dev/null && result=$? || result=$?

    # Check output
    if node -e "
const path = require('path');
const mysql = require(path.join('$PROJECT_ROOT', 'scripts', 'node_modules', 'mysql2', 'promise'));
(async () => {
    const conn = await mysql.createConnection({
        host: '127.0.0.1', port: 3307,
        user: 'penguin', password: 'devpassword', database: 'yukon'
    });
    const [rows] = await conn.execute('SELECT id, member FROM users WHERE username = ?', ['$dev_username']);
    await conn.end();
    if (rows.length > 0) process.exit(0); else process.exit(1);
})();
" 2>/dev/null; then
        ok "Account '$dev_username' ready (member)"
    else
        err "Failed to create account. Check dev database is running."
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5: Discord Bot (Optional)
# ═══════════════════════════════════════════════════════════════════════════════
step_05() {
    header 5 "Discord Bot (Optional)"

    echo "  The Discord bot handles voice channel sync and account linking."
    echo "  It's optional for local dev — the game works fine without it."
    echo ""

    if ! confirm "Set up Discord integration?"; then
        info "Skipping Discord setup. You can configure it later in .env"
        return
    fi

    echo ""
    echo "  You'll need a Discord bot token and guild (server) ID."
    echo "  See: https://discord.com/developers/applications"
    echo ""
    echo "  1. Create a new Application → Bot tab → Reset Token → copy it"
    echo "  2. Enable 'Server Members Intent' and 'Message Content Intent'"
    echo "  3. OAuth2 → URL Generator → 'bot' scope → Move Members, Connect, View Channels"
    echo "  4. Invite the bot to your server with the generated URL"
    echo "  5. Right-click your server → Copy Server ID (enable Developer Mode first)"
    echo ""

    read -rp "  Bot token: " bot_token
    read -rp "  Guild ID:  " guild_id

    if [ -n "$bot_token" ] && [ -n "$guild_id" ]; then
        # Write a minimal .env for dev (only Discord vars needed)
        local env_file="$PROJECT_ROOT/.env.dev"
        cat > "$env_file" <<EOF
# Dev environment Discord config
DISCORD_BOT_TOKEN=$bot_token
DISCORD_GUILD_ID=$guild_id
DISCORD_BOT_PREFIX=!
BOT_API_PORT=3001
BOT_API_HOST=127.0.0.1
EOF
        ok "Discord config saved to .env.dev"
        info "To use: source .env.dev before running dev.sh"
    else
        warn "Incomplete — skipping Discord config."
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6: Verify Setup
# ═══════════════════════════════════════════════════════════════════════════════
find_port() {
    local port=$1 offset=1000
    while ss -tlnp 2>/dev/null | grep -q ":${port} " || lsof -iTCP:$port -sTCP:LISTEN &>/dev/null 2>&1; do
        port=$((port + offset))
    done
    echo $port
}

step_06() {
    header 6 "Verify Setup"

    info "Quick smoke test — starting server briefly..."

    # Use same port detection as dev.sh
    local login_port=$(find_port 6112)
    local world_port=$(find_port 6113)

    cd "$PROJECT_ROOT/yukon-server"
    DEV_LOGIN_PORT=$login_port DEV_WORLD_PORT=$world_port NODE_ENV=development \
        npx babel-watch ./src/World.js Login Blizzard &
    local server_pid=$!
    sleep 4

    local server_ok=true
    if ! ss -tlnp 2>/dev/null | grep -q ":${login_port} " && ! lsof -iTCP:$login_port -sTCP:LISTEN &>/dev/null; then
        warn "Port $login_port (Login) not listening"
        server_ok=false
    else
        ok "Login server on :$login_port"
    fi

    if ! ss -tlnp 2>/dev/null | grep -q ":${world_port} " && ! lsof -iTCP:$world_port -sTCP:LISTEN &>/dev/null; then
        warn "Port $world_port (Blizzard) not listening"
        server_ok=false
    else
        ok "Game server on :$world_port"
    fi

    kill $server_pid 2>/dev/null || true
    wait $server_pid 2>/dev/null || true

    if $server_ok; then
        ok "Server verified!"
    else
        warn "Server didn't bind expected ports. Check config.dev.json and database connection."
    fi

    # Check client port
    local client_port=$(find_port 8080)
    ok "Client port :$client_port available"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 7: Done
# ═══════════════════════════════════════════════════════════════════════════════
step_07() {
    header 7 "You're All Set!"

    echo ""
    echo -e "  ${GREEN}${BOLD}Dev environment is ready.${NC}"
    echo ""
    echo -e "  ${BOLD}Start developing:${NC}"
    echo "    bash scripts/dev.sh"
    echo ""
    echo -e "  ${BOLD}What it runs:${NC}"
    echo "    Dev MySQL ........... localhost:3307  (auto-picks free port if busy)"
    echo "    Yukon server ........ localhost:6112/6113  (auto-picks free ports)"
    echo "    Yukon client ........ http://localhost:8080  (auto-picks free port)"
    echo ""
    echo -e "  ${DIM}Ports adjust automatically — check dev.sh output for actual ports.${NC}"
    echo ""
    echo -e "  ${BOLD}Useful commands:${NC}"
    echo "    node scripts/verify.js list         List all accounts"
    echo "    node scripts/verify.js grant <user>  Grant membership"
    echo "    node scripts/verify.js info <user>   Player details"
    echo ""
    echo -e "  ${BOLD}Deploy to production:${NC}"
    echo "    git push                             Push changes"
    echo "    (on server) git pull                 Pull changes"
    echo "    (on server) bash scripts/rebuild.sh  Rebuild & restart"
    echo ""
    echo -e "  ${BOLD}Edit workflow:${NC}"
    echo "    Client changes → webpack HMR auto-reloads browser"
    echo "    Server changes → babel-watch auto-restarts server"
    echo "    Database changes → edit yukon.sql + add migration to scripts/"
    echo ""
    hr
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}${BOLD}Club Penguin — Dev Environment Setup${NC}"
echo -e "${DIM}Sets up a local dev environment for the Yukon HTML5 client + server${NC}"
hr

step_01
step_02
step_03
step_04
step_05
step_06
step_07

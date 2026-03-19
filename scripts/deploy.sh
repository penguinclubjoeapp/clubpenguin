#!/usr/bin/env bash
# scripts/deploy.sh — Guided deployment wizard for Club Penguin Discord Bridge
#
# Usage: ./scripts/deploy.sh
#
# A 12-step interactive wizard that takes a fresh clone to a running server.
# Each step waits for user confirmation before proceeding.
# Safe to re-run — detects completed steps and offers to skip them.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
INDEX_HTML="$PROJECT_ROOT/media/client/index.html"
MEDIA_DIR="$PROJECT_ROOT/media"
OVERRIDE_FILE="$PROJECT_ROOT/docker-compose.override.yml"
TOTAL_STEPS=12

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

# Escape special characters for sed replacement strings (using | delimiter)
sed_escape() { printf '%s' "$1" | sed 's/[&|\]/\\&/g'; }

header() {
    local num=$1; shift
    echo ""
    echo ""
    echo -e "${CYAN}${BOLD}[$num/$TOTAL_STEPS] $*${NC}"
    hr
}

# Wait for user to press Enter. Returns 1 if user types 's' to skip.
confirm() {
    local prompt="${1:-Press Enter to continue}"
    echo ""
    read -rp "$(echo -e "${DIM}$prompt [Enter=continue / s=skip]:${NC} ")" choice
    [[ "$choice" =~ ^[Ss]$ ]] && return 1
    return 0
}

# Like confirm but no skip option — just a gate.
pause() {
    local prompt="${1:-Press Enter to continue}"
    echo ""
    read -rp "$(echo -e "${DIM}$prompt [Enter]:${NC} ")" _
}

# Docker compose command (set in step 1)
COMPOSE=""

# Websockify port defaults
WS_LOGIN_PORT="${WS_LOGIN_PORT:-7112}"
WS_WORLD_PORT="${WS_WORLD_PORT:-7113}"


# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: Prerequisites
# ═══════════════════════════════════════════════════════════════════════════════
step_01() {
    header 1 "Prerequisites"

    echo "Checking for required tools..."
    echo ""

    MISSING=()
    for cmd in docker git curl unzip openssl; do
        if command -v "$cmd" &>/dev/null; then
            ok "$cmd"
        else
            err "$cmd — not found"
            MISSING+=("$cmd")
        fi
    done

    # Docker compose
    if docker compose version &>/dev/null; then
        COMPOSE="docker compose"
        ok "docker compose ($(docker compose version --short 2>/dev/null || echo 'v2'))"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE="docker-compose"
        ok "docker-compose (standalone)"
    else
        err "docker compose — not found"
        MISSING+=("docker-compose")
    fi

    if [ ${#MISSING[@]} -gt 0 ]; then
        echo ""
        err "Missing: ${MISSING[*]}"
        err "Install them and re-run this script."
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &>/dev/null; then
        echo ""
        err "Docker daemon is not running."
        err "Start it with: sudo systemctl start docker"
        exit 1
    fi
    ok "Docker daemon running"

    pause "All prerequisites met"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Discord Bot Creation Walkthrough
# ═══════════════════════════════════════════════════════════════════════════════
step_02() {
    header 2 "Discord Bot Setup"

    # Skip if token already configured
    if [ -f "$ENV_FILE" ] && grep -q '^DISCORD_BOT_TOKEN=.\+' "$ENV_FILE"; then
        ok "A Discord bot token is already configured in .env"
        confirm "Skip the bot setup walkthrough?" || return 0
    fi

    echo "You need a Discord bot before continuing. Follow these steps:"
    echo ""
    echo -e "${BOLD}  1. Create the application${NC}"
    echo "     Go to: https://discord.com/developers/applications"
    echo "     Click 'New Application' and name it (e.g. 'Club Penguin')"
    echo ""
    echo -e "${BOLD}  2. Get the bot token${NC}"
    echo "     Go to the Bot tab"
    echo "     Click 'Reset Token' and copy it — you'll need it in the next step"
    echo "     (This is a secret — don't share it)"
    echo ""
    echo -e "${BOLD}  3. Enable required intents${NC}"
    echo "     Still on the Bot tab, scroll to 'Privileged Gateway Intents'"
    echo "     Enable these three:"
    echo "       • Server Members Intent"
    echo "       • Message Content Intent"
    echo "       • Presence Intent (optional but recommended)"
    echo ""
    echo -e "${BOLD}  4. Generate the invite link${NC}"
    echo "     Go to OAuth2 → URL Generator"
    echo "     Scopes: select 'bot'"
    echo "     Bot Permissions: select these:"
    echo "       • Move Members"
    echo "       • Connect"
    echo "       • View Channels"
    echo "     Copy the generated URL at the bottom"
    echo ""
    echo -e "${BOLD}  5. Add the bot to your server${NC}"
    echo "     Open the URL in your browser and select your Discord server"
    echo ""
    echo -e "${BOLD}  6. Fix the role hierarchy${NC}"
    echo "     In Discord → Server Settings → Roles"
    echo "     Drag the bot's role ABOVE all users it needs to move"
    echo "     (The bot can only move users with roles below its own)"
    echo ""
    echo -e "${BOLD}  7. Get your Server ID${NC}"
    echo "     In Discord → User Settings → Advanced → enable Developer Mode"
    echo "     Right-click your server name → Copy Server ID"

    pause "Complete all the steps above, then press Enter"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════════
step_03() {
    header 3 "Server Configuration"

    if [ -f "$ENV_FILE" ]; then
        # Check if it looks fully configured
        local token guild pass
        token=$(grep '^DISCORD_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
        guild=$(grep '^DISCORD_GUILD_ID=' "$ENV_FILE" | cut -d= -f2-)
        pass=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

        if [ -n "$token" ] && [ -n "$guild" ] && [ "$pass" != "changeme" ]; then
            ok ".env exists and appears fully configured"
            if confirm "Keep existing configuration?"; then
                set -a; source "$ENV_FILE"; set +a
                return 0
            fi
            rm "$ENV_FILE"
        else
            warn ".env exists but has placeholder values"
            rm "$ENV_FILE"
        fi
    fi

    echo "Collecting values unique to this server."
    echo ""

    # ── Discord bot token ──
    local bot_token=""
    while true; do
        read -rp "  Discord bot token: " bot_token
        if [ -z "$bot_token" ]; then
            err "Required. Paste the token from Step 2."
            continue
        fi
        # Basic format check: three dot-separated segments
        if [[ ! "$bot_token" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
            warn "That doesn't look like a Discord bot token (expected format: XXX.YYY.ZZZ)"
            read -rp "  Use it anyway? [y/N] " use_anyway
            [[ "$use_anyway" =~ ^[Yy]$ ]] && break
            continue
        fi
        break
    done

    # ── Guild ID ──
    local guild_id=""
    while true; do
        read -rp "  Discord server (guild) ID: " guild_id
        if [[ "$guild_id" =~ ^[0-9]+$ ]]; then
            break
        fi
        err "Guild ID must be all digits. Right-click your server → Copy Server ID."
    done

    # ── Public address ──
    echo ""
    info "Detecting public IP..."
    local detected_ip
    detected_ip=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || echo "")

    local game_address=""
    if [ -n "$detected_ip" ]; then
        read -rp "  Public IP or domain [$detected_ip]: " game_address
        game_address="${game_address:-$detected_ip}"
    else
        warn "Could not auto-detect public IP"
        read -rp "  Public IP or domain (127.0.0.1 for local only): " game_address
        game_address="${game_address:-127.0.0.1}"
    fi

    # ── Database password ──
    local db_password
    db_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

    # ── Port conflicts ──
    echo ""
    info "Checking for port conflicts..."

    local media_port=80
    local dash_port=3000
    local login_port=6112
    local world_port=6113
    local ws_lport=7112
    local ws_wport=7113

    check_port() {
        local port=$1 name=$2 default=$3
        if ss -tlnp 2>/dev/null | grep -q ":${port} " ; then
            warn "Port $port ($name) is in use"
            read -rp "  Alternative port [$default]: " alt
            echo "${alt:-$default}"
        else
            ok "Port $port ($name) — available"
            echo "$port"
        fi
    }

    media_port=$(check_port 80 "media server" 8080)
    dash_port=$(check_port 3000 "account registration" 3000)
    login_port=$(check_port 6112 "game login" 6112)
    world_port=$(check_port 6113 "game world" 6113)
    ws_lport=$(check_port 7112 "websocket login proxy" 7112)
    ws_wport=$(check_port 7113 "websocket world proxy" 7113)

    # ── Generate .env ──
    echo ""
    info "Generating .env..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    sed -i "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=$(sed_escape "$bot_token")|" "$ENV_FILE"
    sed -i "s|^DISCORD_GUILD_ID=.*|DISCORD_GUILD_ID=$guild_id|" "$ENV_FILE"
    sed -i "s|^GAME_ADDRESS=.*|GAME_ADDRESS=$(sed_escape "$game_address")|" "$ENV_FILE"
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(sed_escape "$db_password")|" "$ENV_FILE"
    sed -i "s|^MEDIA_PORT=.*|MEDIA_PORT=$media_port|" "$ENV_FILE"
    sed -i "s|^WEB_HOSTNAME=.*|WEB_HOSTNAME=$(sed_escape "$game_address")|" "$ENV_FILE"
    sed -i "s|^GAME_LOGIN_PORT=.*|GAME_LOGIN_PORT=$login_port|" "$ENV_FILE"
    sed -i "s|^GAME_WORLD_PORT=.*|GAME_WORLD_PORT=$world_port|" "$ENV_FILE"
    sed -i "s|^DASH_PORT=.*|DASH_PORT=$dash_port|" "$ENV_FILE"

    # Append websockify ports (not in .env.example)
    echo "" >> "$ENV_FILE"
    echo "# WebSocket proxy ports (websockify — bridges browser WS to Houdini TCP)" >> "$ENV_FILE"
    echo "WS_LOGIN_PORT=$ws_lport" >> "$ENV_FILE"
    echo "WS_WORLD_PORT=$ws_wport" >> "$ENV_FILE"

    # Export for later steps
    set -a; source "$ENV_FILE"; set +a

    echo ""
    ok ".env created"
    echo ""
    echo "  Game address:     $game_address"
    echo "  Media port:       $media_port"
    echo "  Dash port:        $dash_port"
    echo "  Login port:       $login_port (TCP) / $ws_lport (WebSocket)"
    echo "  World port:       $world_port (TCP) / $ws_wport (WebSocket)"
    echo "  DB password:      $db_password"

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: Download Media Assets
# ═══════════════════════════════════════════════════════════════════════════════
step_04() {
    header 4 "Download Media Assets"

    if [ -d "$MEDIA_DIR/play" ] && [ -f "$MEDIA_DIR/ruffle/ruffle.js" ]; then
        ok "Game SWFs and Ruffle are already downloaded"
        confirm "Skip media download?" && return 0
    fi

    echo "This will download:"
    echo "  • Solero legacy-media (Club Penguin AS2 game SWFs)"
    echo "  • Ruffle self-hosted (Flash emulator for browsers)"
    echo ""
    warn "The SWF download can be large and may take a while."

    if ! confirm "Start download?"; then
        warn "Skipped. Run scripts/fetch-media.sh manually before playing."
        return 0
    fi

    bash "$PROJECT_ROOT/scripts/fetch-media.sh"

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 5: Detect SWF Path & Patch Client
# ═══════════════════════════════════════════════════════════════════════════════
step_05() {
    header 5 "Configure Game Client"

    # Source .env if not already loaded
    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    local ws_lport="${WS_LOGIN_PORT:-7112}"
    local ws_wport="${WS_WORLD_PORT:-7113}"

    # ── Detect boot.swf ──
    local swf_path=""
    local candidates=(
        "play/v2/client/boot.swf"
        "play/v2/content/local/en/boot.swf"
        "play/v2/content/local/boot.swf"
        "play/client/boot.swf"
        "play/boot.swf"
    )

    for candidate in "${candidates[@]}"; do
        if [ -f "$MEDIA_DIR/$candidate" ]; then
            swf_path="/$candidate"
            break
        fi
    done

    if [ -z "$swf_path" ]; then
        local found
        found=$(find "$MEDIA_DIR" -name "boot.swf" -type f 2>/dev/null | head -1)
        if [ -n "$found" ]; then
            swf_path="/${found#"$MEDIA_DIR/"}"
        fi
    fi

    if [ -z "$swf_path" ]; then
        warn "Could not find boot.swf in media directory."
        warn "If you haven't downloaded media yet, go back and run Step 4."
        read -rp "  Enter the SWF path manually (or press Enter to skip): " swf_path
        if [ -z "$swf_path" ]; then
            warn "Skipping client patching. Update media/client/index.html manually."
            pause
            return 0
        fi
    else
        ok "Found boot SWF at: $swf_path"
    fi

    # ── Patch index.html ──
    local changes=0

    local current_swf
    current_swf=$(grep -oP 'swfPath:\s*"[^"]*"' "$INDEX_HTML" | grep -oP '"[^"]*"' | tr -d '"')
    if [ "$current_swf" != "$swf_path" ]; then
        sed -i "s|swfPath:.*|swfPath: \"$swf_path\",|" "$INDEX_HTML"
        ok "swfPath: $current_swf → $swf_path"
        changes=1
    else
        ok "swfPath already correct"
    fi

    local current_ws_login
    current_ws_login=$(grep -oP 'wsLoginPort:\s*[0-9]+' "$INDEX_HTML" | grep -oP '[0-9]+')
    if [ "$current_ws_login" != "$ws_lport" ]; then
        sed -i "s|wsLoginPort:.*|wsLoginPort: $ws_lport,|" "$INDEX_HTML"
        ok "wsLoginPort: $current_ws_login → $ws_lport"
        changes=1
    else
        ok "wsLoginPort already correct"
    fi

    local current_ws_world
    current_ws_world=$(grep -oP 'wsWorldPort:\s*[0-9]+' "$INDEX_HTML" | grep -oP '[0-9]+')
    if [ "$current_ws_world" != "$ws_wport" ]; then
        sed -i "s|wsWorldPort:.*|wsWorldPort: $ws_wport,|" "$INDEX_HTML"
        ok "wsWorldPort: $current_ws_world → $ws_wport"
        changes=1
    else
        ok "wsWorldPort already correct"
    fi

    if [ "$changes" -eq 0 ]; then
        ok "index.html already fully configured"
    fi

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 6: Generate WebSocket Proxy (docker-compose.override.yml)
# ═══════════════════════════════════════════════════════════════════════════════
step_06() {
    header 6 "WebSocket Proxy Setup"

    echo "Ruffle (the Flash emulator) can't open raw TCP sockets from a browser."
    echo "Websockify bridges WebSocket connections to Houdini's TCP ports."
    echo ""

    if [ -f "$OVERRIDE_FILE" ] && grep -q "websockify" "$OVERRIDE_FILE"; then
        ok "docker-compose.override.yml already contains websockify services"
        confirm "Regenerate it?" || return 0
    fi

    # Source .env if needed
    if [ -z "${GAME_LOGIN_PORT:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    local login_port="${GAME_LOGIN_PORT:-6112}"
    local world_port="${GAME_WORLD_PORT:-6113}"
    local ws_lport="${WS_LOGIN_PORT:-7112}"
    local ws_wport="${WS_WORLD_PORT:-7113}"

    cat > "$OVERRIDE_FILE" <<EOF
# Auto-generated by deploy.sh — WebSocket proxies for browser play
# Bridges browser WS connections to Houdini's TCP game ports via websockify.
# This file is gitignored and merged automatically by docker compose.

services:
  websockify-login:
    image: efrecon/websockify:latest
    restart: unless-stopped
    command: "0.0.0.0:${ws_lport} houdini-login:${login_port}"
    ports:
      - "${ws_lport}:${ws_lport}"
    networks:
      - clubpenguin
    depends_on:
      houdini-login:
        condition: service_healthy

  websockify-world:
    image: efrecon/websockify:latest
    restart: unless-stopped
    command: "0.0.0.0:${ws_wport} houdini-world:${world_port}"
    ports:
      - "${ws_wport}:${ws_wport}"
    networks:
      - clubpenguin
    depends_on:
      houdini-world:
        condition: service_healthy
EOF

    ok "Created docker-compose.override.yml"
    echo ""
    echo "  websockify-login:  port $ws_lport → houdini-login:$login_port"
    echo "  websockify-world:  port $ws_wport → houdini-world:$world_port"

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 7: Build and Start Containers
# ═══════════════════════════════════════════════════════════════════════════════
step_07() {
    header 7 "Build & Launch"

    # Source .env if needed
    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    # Check if already running
    cd "$PROJECT_ROOT"
    local running
    running=$($COMPOSE ps --status running --format '{{.Name}}' 2>/dev/null | wc -l || echo 0)
    if [ "$running" -gt 0 ]; then
        ok "$running service(s) already running"
        if confirm "Rebuild and restart everything?"; then
            $COMPOSE down
        else
            return 0
        fi
    fi

    echo "This will:"
    echo "  • Build container images for Houdini, Dash, and the Discord bot"
    echo "  • Pull images for PostgreSQL, Redis, nginx, and websockify"
    echo "  • Start all services"
    echo ""
    warn "First build may take several minutes."

    if ! confirm "Start build?"; then
        warn "Skipped. Run '$COMPOSE up -d --build' manually."
        return 0
    fi

    info "Building containers..."
    $COMPOSE build

    info "Starting services..."
    $COMPOSE up -d

    info "Waiting for services to become healthy..."
    local timeout=120
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local unhealthy
        unhealthy=$($COMPOSE ps 2>/dev/null | grep -c -i 'starting\|unhealthy' || true)
        if [ "$unhealthy" = "0" ]; then
            break
        fi
        printf "."
        sleep 3
        elapsed=$((elapsed + 3))
    done
    echo ""

    if [ $elapsed -ge $timeout ]; then
        warn "Some services may still be starting."
    else
        ok "All services started"
    fi

    echo ""
    $COMPOSE ps

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 8: Smoke Test
# ═══════════════════════════════════════════════════════════════════════════════
step_08() {
    header 8 "Smoke Test"

    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    echo "Checking that each service is responding..."
    echo ""

    local media_port="${MEDIA_PORT:-80}"
    local dash_port="${DASH_PORT:-3000}"
    local login_port="${GAME_LOGIN_PORT:-6112}"
    local world_port="${GAME_WORLD_PORT:-6113}"
    local ws_lport="${WS_LOGIN_PORT:-7112}"
    local ws_wport="${WS_WORLD_PORT:-7113}"
    local bot_port="${BOT_API_PORT:-3001}"
    local failures=0

    check_http() {
        local name=$1 port=$2 path=${3:-/}
        if curl -sf --max-time 3 "http://localhost:${port}${path}" &>/dev/null; then
            ok "$name (port $port)"
        else
            err "$name (port $port) — not responding"
            failures=$((failures + 1))
        fi
    }

    check_tcp() {
        local name=$1 port=$2
        if nc -z -w 3 localhost "$port" 2>/dev/null; then
            ok "$name (port $port)"
        else
            err "$name (port $port) — not responding"
            failures=$((failures + 1))
        fi
    }

    check_http "Media server" "$media_port" "/healthz"
    check_http "Dash (accounts)" "$dash_port"
    check_tcp  "Houdini login" "$login_port"
    check_tcp  "Houdini world" "$world_port"
    check_tcp  "WebSocket login proxy" "$ws_lport"
    check_tcp  "WebSocket world proxy" "$ws_wport"
    check_tcp  "Discord bot API" "$bot_port"

    echo ""
    if [ "$failures" -gt 0 ]; then
        warn "$failures service(s) failed. Check logs with: $COMPOSE logs"
    else
        ok "All services responding"
    fi

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 9: Firewall Instructions
# ═══════════════════════════════════════════════════════════════════════════════
step_09() {
    header 9 "Firewall Configuration"

    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    local media_port="${MEDIA_PORT:-80}"
    local dash_port="${DASH_PORT:-3000}"
    local ws_lport="${WS_LOGIN_PORT:-7112}"
    local ws_wport="${WS_WORLD_PORT:-7113}"

    echo "If this server has a firewall, open these ports for remote players:"
    echo ""
    echo -e "${BOLD}  Open these (required for remote play):${NC}"
    echo "  ┌────────┬──────────┬────────────────────────────────────┐"
    echo "  │ Port   │ Protocol │ Service                            │"
    echo "  ├────────┼──────────┼────────────────────────────────────┤"
    printf "  │ %-6s │ TCP      │ Game client webpage                │\n" "$media_port"
    printf "  │ %-6s │ TCP      │ Account registration (Dash)        │\n" "$dash_port"
    printf "  │ %-6s │ TCP      │ WebSocket login proxy              │\n" "$ws_lport"
    printf "  │ %-6s │ TCP      │ WebSocket world proxy              │\n" "$ws_wport"
    echo "  └────────┴──────────┴────────────────────────────────────┘"
    echo ""
    echo -e "${BOLD}  Keep closed (internal only):${NC}"
    echo "  ┌────────┬────────────────────────────────────┐"
    echo "  │ Port   │ Service                            │"
    echo "  ├────────┼────────────────────────────────────┤"
    echo "  │ 5432   │ PostgreSQL database                │"
    echo "  │ 6379   │ Redis                              │"
    printf "  │ %-6s │ Discord bot internal API            │\n" "${BOT_API_PORT:-3001}"
    echo "  └────────┴────────────────────────────────────┘"
    echo ""

    # Detect firewall tool
    if command -v ufw &>/dev/null; then
        echo -e "${BOLD}  ufw commands:${NC}"
        echo "    sudo ufw allow $media_port/tcp"
        echo "    sudo ufw allow $dash_port/tcp"
        echo "    sudo ufw allow $ws_lport/tcp"
        echo "    sudo ufw allow $ws_wport/tcp"
    fi
    if command -v firewall-cmd &>/dev/null; then
        echo -e "${BOLD}  firewalld commands:${NC}"
        echo "    sudo firewall-cmd --permanent --add-port=$media_port/tcp"
        echo "    sudo firewall-cmd --permanent --add-port=$dash_port/tcp"
        echo "    sudo firewall-cmd --permanent --add-port=$ws_lport/tcp"
        echo "    sudo firewall-cmd --permanent --add-port=$ws_wport/tcp"
        echo "    sudo firewall-cmd --reload"
    fi
    if command -v iptables &>/dev/null && ! command -v ufw &>/dev/null && ! command -v firewall-cmd &>/dev/null; then
        echo -e "${BOLD}  iptables commands:${NC}"
        echo "    sudo iptables -A INPUT -p tcp --dport $media_port -j ACCEPT"
        echo "    sudo iptables -A INPUT -p tcp --dport $dash_port -j ACCEPT"
        echo "    sudo iptables -A INPUT -p tcp --dport $ws_lport -j ACCEPT"
        echo "    sudo iptables -A INPUT -p tcp --dport $ws_wport -j ACCEPT"
    fi

    if ! command -v ufw &>/dev/null && ! command -v firewall-cmd &>/dev/null; then
        info "No firewall tool detected — you may not have a host firewall enabled."
    fi

    pause "Review the above, then press Enter"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 10: Port Forwarding Instructions
# ═══════════════════════════════════════════════════════════════════════════════
step_10() {
    header 10 "Router Port Forwarding"

    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    local media_port="${MEDIA_PORT:-80}"
    local dash_port="${DASH_PORT:-3000}"
    local ws_lport="${WS_LOGIN_PORT:-7112}"
    local ws_wport="${WS_WORLD_PORT:-7113}"

    # Detect LAN IP
    local lan_ip
    lan_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "<this machine's LAN IP>")

    echo "If this server is behind a router/NAT (home network, etc.),"
    echo "you need to forward ports from your router to this machine."
    echo ""
    echo -e "  This machine's LAN IP: ${BOLD}$lan_ip${NC}"
    echo -e "  Public address:        ${BOLD}${GAME_ADDRESS:-?}${NC}"
    echo ""
    echo -e "${BOLD}  Forward these in your router's admin panel:${NC}"
    echo ""
    echo "  ┌──────────────┬──────────┬──────────────────────────────────┐"
    echo "  │ External     │ Internal │ Purpose                          │"
    echo "  │ Port         │ Port     │                                  │"
    echo "  ├──────────────┼──────────┼──────────────────────────────────┤"
    printf "  │ %-12s │ %-8s │ Game client webpage              │\n" "$media_port" "$media_port"
    printf "  │ %-12s │ %-8s │ Account registration             │\n" "$dash_port" "$dash_port"
    printf "  │ %-12s │ %-8s │ WebSocket login proxy            │\n" "$ws_lport" "$ws_lport"
    printf "  │ %-12s │ %-8s │ WebSocket world proxy            │\n" "$ws_wport" "$ws_wport"
    echo "  └──────────────┴──────────┴──────────────────────────────────┘"
    echo ""
    echo "  All ports are TCP. Forward them to: $lan_ip"
    echo ""
    echo -e "${BOLD}  Do NOT forward:${NC} 5432 (database), 6379 (Redis), ${BOT_API_PORT:-3001} (bot API)"
    echo ""
    echo -e "${DIM}  If your server has a public IP (VPS/cloud), skip this step —${NC}"
    echo -e "${DIM}  port forwarding is only needed for home/NAT networks.${NC}"

    pause "Configure port forwarding, then press Enter"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 11: Docker Auto-Start
# ═══════════════════════════════════════════════════════════════════════════════
step_11() {
    header 11 "Auto-Start on Boot"

    if systemctl is-enabled docker &>/dev/null; then
        ok "Docker is already set to start on boot"
    else
        echo "Docker is not set to start on boot."
        echo "All containers use 'restart: unless-stopped', so they'll come back"
        echo "automatically — but only if the Docker daemon itself starts."
        echo ""
        echo "  Enable it with:"
        echo "    sudo systemctl enable docker"
    fi

    pause
}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 12: Post-Setup Guide
# ═══════════════════════════════════════════════════════════════════════════════
step_12() {
    header 12 "You're Done — Getting Started"

    if [ -z "${GAME_ADDRESS:-}" ] && [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    fi

    local media_port="${MEDIA_PORT:-80}"
    local dash_port="${DASH_PORT:-3000}"
    local addr="${GAME_ADDRESS:-127.0.0.1}"

    echo ""
    echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}  ║     Club Penguin server is ready! 🐧        ║${NC}"
    echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════╝${NC}"
    echo ""

    # ── URLs ──
    echo -e "${BOLD}  Your URLs:${NC}"
    echo "    Game client:      http://$addr:$media_port/client/"
    echo "    Create account:   http://$addr:$dash_port"
    echo ""

    # ── Create an account ──
    hr
    echo -e "${BOLD}  A) Create a penguin account${NC}"
    echo "     1. Go to http://$addr:$dash_port"
    echo "     2. Register a username and password"
    echo "     3. Accounts are auto-activated (no email needed)"
    echo ""

    # ── Play ──
    hr
    echo -e "${BOLD}  B) Play the game${NC}"
    echo "     1. Open http://$addr:$media_port/client/ in your browser"
    echo "     2. Log in with the account you just created"
    echo "     3. Pick the world 'Blizzard' and start waddling"
    echo ""

    # ── Discord linking ──
    hr
    echo -e "${BOLD}  C) Link Discord to your penguin${NC}"
    echo "     1. In any Discord text channel, type:  !link"
    echo "     2. The bot DMs you a code (valid for 5 minutes)"
    echo "     3. In-game, open chat and type:  !link THECODE"
    echo "     4. You'll get a confirmation DM — you're linked!"
    echo ""

    # ── Voice channel mapping ──
    hr
    echo -e "${BOLD}  D) Set up Discord voice channels${NC}"
    echo ""
    echo "     Create voice channels in Discord for the rooms you want,"
    echo "     then map them with the !mapchannel command:"
    echo ""
    echo "       !mapchannel 100 #town"
    echo "       !mapchannel 110 #coffee-shop"
    echo "       !mapchannel 200 #plaza"
    echo ""
    echo "     Common Club Penguin room IDs:"
    echo ""
    echo "       100  Town               300  Ski Village"
    echo "       110  Coffee Shop         310  Ski Hill"
    echo "       120  Book Room           320  Ski Lodge"
    echo "       130  Night Club          330  Lodge Attic"
    echo "       200  Plaza               400  Beach"
    echo "       210  Pet Shop            410  Lighthouse"
    echo "       220  Dojo                420  Beacon"
    echo "       230  Pizza Parlor        800  Dock"
    echo "       801  Iceberg             802  HQ"
    echo "       803  Boiler Room         804  Gift Shop"
    echo "       805  Forest              806  Cove"
    echo "       807  Mine                808  Mine Shack"
    echo ""
    echo "     Use !listchannels to see current mappings."
    echo "     Use !unmapchannel ROOM_ID to remove one."
    echo ""

    # ── Management ──
    hr
    echo -e "${BOLD}  E) Server management${NC}"
    echo ""
    echo "     $COMPOSE ps            # Service status"
    echo "     $COMPOSE logs -f       # Tail all logs"
    echo "     $COMPOSE logs -f dash  # Tail one service"
    echo "     $COMPOSE restart       # Restart everything"
    echo "     $COMPOSE down          # Stop everything"
    echo "     $COMPOSE up -d         # Start everything"
    echo ""

    hr
    echo ""
    echo "  Have fun! 🎉"
    echo ""
}


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Club Penguin Discord Bridge — Deployment Wizard${NC}"
echo -e "${DIM}12-step guided setup. Press Enter to advance, 's' to skip a step.${NC}"

step_01
step_02
step_03
step_04
step_05
step_06
step_07
step_08
step_09
step_10
step_11
step_12

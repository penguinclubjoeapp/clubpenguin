#!/usr/bin/env bash
# scripts/fetch-media.sh — Fetch Club Penguin AS2 game assets and Ruffle player
#
# Usage: ./scripts/fetch-media.sh
#
# Populates the media/ directory with:
#   1. Club Penguin game SWFs (AS2 media)
#   2. Web service JSON files (stamps, games, etc.)
#   3. Ruffle self-hosted release (Flash emulator WASM/JS)
#
# The media/ directory is gitignored — assets are Disney IP and must not be
# committed to the repository.
#
# ── Primary source ─────────────────────────────────────────────────────────
#   - https://git.solero.me/solero/legacy-media.git (compatible with Houdini)
#
# ── Alternative sources ────────────────────────────────────────────────────
#   - https://archives.clubpenguinwiki.info/wiki/Main_Page

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA_DIR="$PROJECT_ROOT/media"
TMP_DIR="$MEDIA_DIR/legacy-media-tmp"

# ── 1. Club Penguin game media ──────────────────────────────────────────────
# Check if both SWFs and web_service files exist
if [ -f "$MEDIA_DIR/play/v2/client/load.swf" ] && [ -f "$MEDIA_DIR/play/en/web_service/stamps.json" ]; then
    echo "[media] Game media already present (load.swf and web_service files found), skipping."
else
    echo "[media] Downloading Club Penguin media (this may take a while)..."
    echo "[media] Source: https://git.solero.me/solero/legacy-media.git"

    # Clean up any incomplete previous download
    rm -rf "$MEDIA_DIR/play" 2>/dev/null || true
    rm -rf "$TMP_DIR" 2>/dev/null || true

    mkdir -p "$MEDIA_DIR"

    # Clone the media repository
    if ! git clone --depth 1 https://git.solero.me/solero/legacy-media.git "$TMP_DIR"; then
        echo "[media] ERROR: Failed to clone repository"
        exit 1
    fi

    # Solero legacy-media has two directories:
    #   - media/play/v2/... (game SWFs)
    #   - play/... (web files including en/web_service/*.json)
    # We need to merge both into our play/ directory

    mkdir -p "$MEDIA_DIR/play"

    # First, copy the game SWFs from media/play/
    if [ -d "$TMP_DIR/media/play" ]; then
        cp -r "$TMP_DIR/media/play/"* "$MEDIA_DIR/play/"
        echo "[media] Copied game SWFs from media/play/"
    else
        echo "[media] ERROR: Expected media/play/ directory not found in repo"
        rm -rf "$TMP_DIR"
        exit 1
    fi

    # Then, copy the web files from play/ (includes web_service JSON files)
    if [ -d "$TMP_DIR/play" ]; then
        cp -r "$TMP_DIR/play/"* "$MEDIA_DIR/play/"
        echo "[media] Copied web files from play/ (includes web_service JSONs)"
    else
        echo "[media] WARNING: play/ directory not found, web_service files may be missing"
    fi

    # Clean up
    rm -rf "$TMP_DIR"

    # Verify critical files exist
    if [ ! -f "$MEDIA_DIR/play/v2/client/load.swf" ]; then
        echo "[media] ERROR: load.swf not found after download"
        exit 1
    fi

    # Verify web_service files exist
    MISSING_FILES=0
    for f in en/web_service/stamps.json en/web_service/games.json web_service/weblogger.json; do
        if [ ! -f "$MEDIA_DIR/play/$f" ]; then
            echo "[media] WARNING: Missing $f"
            MISSING_FILES=$((MISSING_FILES + 1))
        fi
    done

    if [ $MISSING_FILES -gt 0 ]; then
        echo "[media] WARNING: $MISSING_FILES web_service files are missing"
    else
        echo "[media] All web_service files present"
    fi

    SWF_COUNT=$(find "$MEDIA_DIR/play" -name "*.swf" | wc -l)
    echo "[media] Downloaded $SWF_COUNT SWF files to $MEDIA_DIR/play"
fi

# ── 2. Ruffle self-hosted release ───────────────────────────────────────────
RUFFLE_DIR="$MEDIA_DIR/ruffle"
if [ -d "$RUFFLE_DIR" ] && [ -f "$RUFFLE_DIR/ruffle.js" ]; then
    echo "[ruffle] Ruffle already present, skipping."
else
    echo "[ruffle] Downloading latest Ruffle self-hosted release..."
    mkdir -p "$RUFFLE_DIR"
    # Use /releases instead of /releases/latest since Ruffle only publishes prereleases
    # Use || true to prevent pipefail from exiting on empty grep results
    RUFFLE_URL=$(curl -sL https://api.github.com/repos/ruffle-rs/ruffle/releases \
        | grep -o '"browser_download_url": *"[^"]*selfhosted[^"]*\.zip"' \
        | head -1 \
        | cut -d'"' -f4 || true)
    if [ -z "$RUFFLE_URL" ]; then
        echo "[ruffle] ERROR: Could not determine Ruffle download URL."
        echo "[ruffle] Download the self-hosted ZIP manually from:"
        echo "[ruffle]   https://github.com/ruffle-rs/ruffle/releases"
        echo "[ruffle] and extract it into media/ruffle/"
        exit 1
    fi
    TMPZIP="$(mktemp)"
    curl -sL -o "$TMPZIP" "$RUFFLE_URL"
    unzip -oq "$TMPZIP" -d "$RUFFLE_DIR"
    rm -f "$TMPZIP"
    echo "[ruffle] Ruffle installed to $RUFFLE_DIR"
fi

echo ""
echo "[done] Media assets ready. Start with: docker-compose up -d media-server"

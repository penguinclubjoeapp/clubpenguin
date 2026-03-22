#!/usr/bin/env bash
# scripts/fetch-media.sh — Fetch Club Penguin AS2 game assets and Ruffle player
#
# Usage: ./scripts/fetch-media.sh
#
# Populates the media/ directory with:
#   1. Club Penguin game SWFs (AS2 media from cpcontinued)
#   2. Ruffle self-hosted release (Flash emulator WASM/JS)
#
# The media/ directory is gitignored — assets are Disney IP and must not be
# committed to the repository.
#
# ── Primary source ─────────────────────────────────────────────────────────
#   - https://github.com/anthonywww/cpcontinuned-media (clean original CP media)
#
# ── Alternative sources ────────────────────────────────────────────────────
#   - https://git.solero.me/solero/legacy-media.git
#   - https://archives.clubpenguinwiki.info/wiki/Main_Page

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA_DIR="$PROJECT_ROOT/media"
TMP_DIR="$MEDIA_DIR/cpcontinued-tmp"

# ── 1. Club Penguin game media ──────────────────────────────────────────────
# Check if SWFs exist (cpcontinued uses different paths)
if [ -f "$MEDIA_DIR/play/v2/client/shell.swf" ] || [ -f "$MEDIA_DIR/play/v2/client/load.swf" ]; then
    echo "[media] Game media already present, skipping."
else
    echo "[media] Downloading Club Penguin media (this may take a while)..."
    echo "[media] Source: https://github.com/anthonywww/cpcontinuned-media"

    # Clean up any incomplete previous download
    rm -rf "$MEDIA_DIR/play" 2>/dev/null || true
    rm -rf "$TMP_DIR" 2>/dev/null || true

    mkdir -p "$MEDIA_DIR"

    # Clone the media repository
    if ! git clone --depth 1 https://github.com/anthonywww/cpcontinuned-media.git "$TMP_DIR"; then
        echo "[media] ERROR: Failed to clone repository"
        exit 1
    fi

    # cpcontinued-media structure:
    #   - public/ contains the media files (v2/client/, etc.)
    # We copy public/ contents to our play/ directory

    mkdir -p "$MEDIA_DIR/play"

    if [ -d "$TMP_DIR/public" ]; then
        cp -r "$TMP_DIR/public/"* "$MEDIA_DIR/play/"
        echo "[media] Copied media from public/"
    else
        echo "[media] ERROR: Expected public/ directory not found in repo"
        rm -rf "$TMP_DIR"
        exit 1
    fi

    # Clean up
    rm -rf "$TMP_DIR"

    # Verify critical files exist (cpcontinued may use shell.swf or boot.swf instead of load.swf)
    BOOT_SWF=""
    for candidate in v2/client/shell.swf v2/client/load.swf v2/client/boot.swf boot.swf; do
        if [ -f "$MEDIA_DIR/play/$candidate" ]; then
            BOOT_SWF="$candidate"
            break
        fi
    done

    if [ -z "$BOOT_SWF" ]; then
        echo "[media] WARNING: No boot SWF found (tried shell.swf, load.swf, boot.swf)"
        echo "[media] Available SWFs:"
        find "$MEDIA_DIR/play" -name "*.swf" -type f | head -20
    else
        echo "[media] Found boot SWF: $BOOT_SWF"
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

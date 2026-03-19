#!/usr/bin/env bash
# scripts/fetch-media.sh — Fetch Club Penguin AS2 game assets and Ruffle player
#
# Usage: ./scripts/fetch-media.sh
#
# Populates the media/ directory with:
#   1. Solero legacy-media (AS2 game SWFs)
#   2. Ruffle self-hosted release (Flash emulator WASM/JS)
#
# The media/ directory is gitignored — assets are Disney IP and must not be
# committed to the repository.
#
# ── Fallback sources if Solero GitLab is down ──────────────────────────────
#   - https://github.com/d3spi/Club-Penguin-SWF-Archive
#   - https://github.com/abarichello/cp-swf
#   - https://github.com/anthonywww/cpcontinuned-media
#   - https://archives.clubpenguinwiki.info/wiki/Main_Page

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA_DIR="$PROJECT_ROOT/media"

# ── 1. Solero legacy-media ──────────────────────────────────────────────────
if [ -d "$MEDIA_DIR/play" ]; then
    echo "[media] Solero legacy-media already present, skipping."
else
    echo "[media] Cloning Solero legacy-media (this may take a while)..."
    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' EXIT
    git clone --depth 1 https://git.solero.me/solero/legacy-media.git "$TMPDIR"
    mkdir -p "$MEDIA_DIR"
    rsync -a --exclude='.git' "$TMPDIR/" "$MEDIA_DIR/"
    rm -rf "$TMPDIR"
    trap - EXIT
    echo "[media] Legacy media downloaded to $MEDIA_DIR"
fi

# ── 2. Ruffle self-hosted release ───────────────────────────────────────────
RUFFLE_DIR="$MEDIA_DIR/ruffle"
if [ -d "$RUFFLE_DIR" ] && [ -f "$RUFFLE_DIR/ruffle.js" ]; then
    echo "[ruffle] Ruffle already present, skipping."
else
    echo "[ruffle] Downloading latest Ruffle self-hosted release..."
    mkdir -p "$RUFFLE_DIR"
    RUFFLE_URL=$(curl -sL https://api.github.com/repos/ruffle-rs/ruffle/releases/latest \
        | grep -o '"browser_download_url": *"[^"]*selfhosted[^"]*\.zip"' \
        | head -1 \
        | cut -d'"' -f4)
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

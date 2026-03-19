# Project Complete

All issues (#1–#13) are closed. The Club Penguin private server with Discord voice integration is fully implemented.

## What This Project Is

A self-hosted Club Penguin private server with Discord voice integration. When a player changes rooms in-game, a Houdini plugin notifies a Discord bot which moves them to the matching voice channel. The whole stack is containerized with Docker Compose.

## Key Docs

- `README.md` — project overview, architecture diagram, how account linking and room sync work
- `Penguin.md` — research on CP server software (Houdini, Waddle-Forever), client options (Ruffle, Project Aether), community history
- `VC.md` — detailed technical spec for the Discord voice integration: Houdini plugin code, Discord bot code, account linking flow, future extensions

## Before First Run

1. Copy `.env.example` to `.env` and fill in `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and change `POSTGRES_PASSWORD`
2. Run `./scripts/fetch-media.sh` to download game assets and Ruffle
3. Update the `swfPath` in `media/client/index.html` to match the actual boot SWF path from the fetched assets
4. Set up a WebSocket-to-TCP proxy (e.g. websockify) for Houdini's login/world ports if playing in-browser
5. `docker compose up -d`

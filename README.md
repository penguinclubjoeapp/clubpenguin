# ClubPenguin

Self-hosted Club Penguin server with Discord voice chat integration. Room changes in-game automatically move players between Discord voice channels.

## Overview

A fully containerized Club Penguin private server built on [Houdini](https://github.com/solero/houdini), with a custom plugin that syncs in-game room transitions to Discord voice channels. When a linked player walks into the Coffee Shop, they get moved to the Coffee Shop voice channel. The entire stack deploys with a single `docker-compose up -d`.

Built for friend groups who want a private CP hangout with spatial voice — everyone in the same room hears each other, walk to a different room and you join a different call.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                               │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   Houdini   │  │     Dash     │  │   nginx     │  │  Discord  │  │
│  │ Game Server │  │ Web Services │  │Media Server │  │    Bot    │  │
│  │  :6112/13   │  │    :3000     │  │    :80      │  │  :3001    │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────────┘  └─────┬─────┘  │
│         │                │                                  │        │
│  ┌──────┴────────────────┴──────────────────────────────────┘        │
│  │                                                                   │
│  │  ┌──────────────────┐                                             │
│  └──┤   PostgreSQL     │                                             │
│     │  penguin accounts│                                             │
│     │  discord_links   │                                             │
│     └──────────────────┘                                             │
└──────────────────────────────────────────────────────────────────────┘

Data flow:

  Player joins room
        │
        ▼
  Houdini catches XTPacket('j','jr')
        │
        ▼
  Room Sync Plugin looks up discord_links table
        │
        ▼
  HTTP POST to Discord Bot /move endpoint
        │
        ▼
  Bot calls member.move_to(channel)
        │
        ▼
  Player is now in the matching voice channel
```

## How It Works

### Account Linking

Players link their Club Penguin and Discord accounts using a one-time code:

1. Run `!link` in a Discord text channel — the bot DMs you a code
2. Log into Club Penguin and type `!link <CODE>` in the in-game chat
3. The bot confirms the link. Your accounts are now paired in the `discord_links` table

Codes expire after 5 minutes. Each CP account maps to one Discord account.

### Room Sync

Once linked, room transitions are automatic:

- Player walks into the Plaza → moved to the Plaza voice channel
- Player walks into the Pizza Parlor → moved to the Pizza Parlor voice channel
- Players without a linked Discord account are unaffected

The player must already be in any voice channel on the Discord server for the bot to move them. Discord does not allow bots to force-connect users.

## Prerequisites

- **Docker** and **Docker Compose**
- **Discord bot token** — create one at the [Discord Developer Portal](https://discord.com/developers/applications). The bot needs `Move Members`, `Connect`, and `View Channels` permissions, and its role must be above the users it moves.
- **Discord server** with a voice channel for each CP room you want to sync
- **Game assets** — SWF files fetched via `./scripts/fetch-media.sh` (see [Media Assets](#media-assets))

## Quickstart

```bash
git clone https://github.com/Borges-Fable/ClubPenguin.git
cd ClubPenguin
cp .env.example .env
# Edit .env — add your DB password, Discord bot token, guild ID, and channel mappings
./scripts/fetch-media.sh
docker-compose up -d
```

See `.env.example` for documentation on each variable.

## Media Assets

Club Penguin game assets (SWFs) are not included in this repository. Run the fetch script to download them:

```bash
./scripts/fetch-media.sh
```

This downloads:
- **Solero legacy-media** — AS2 game SWFs into `media/play/...`
- **Ruffle** — Flash emulator (WASM/JS) into `media/ruffle/`

The `media/` directory is gitignored. Assets are served by the nginx container at `http://localhost:${MEDIA_PORT:-80}/`.

If Solero's GitLab is unavailable, see the fallback sources listed in `scripts/fetch-media.sh`.

## Project Status

Implementation is in progress. Track work in [GitHub Issues](https://github.com/Borges-Fable/ClubPenguin/issues).

## Going Forward

Future possibilities beyond the core room sync:

- **Igloo voice rooms** — dynamically create temporary voice channels when players visit igloos, cleaned up when empty
- **AFK timeout** — move idle players to a lobby channel after 5 minutes of no movement
- **Proximity-based audio** — scale volume based on in-game distance between players within a room

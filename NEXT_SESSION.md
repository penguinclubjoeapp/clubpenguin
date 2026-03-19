# Next Session

## What This Project Is

A self-hosted Club Penguin private server with Discord voice integration. When a player changes rooms in-game, a Houdini plugin notifies a Discord bot which moves them to the matching voice channel. The whole stack is containerized with Docker Compose.

Key docs:
- `README.md` — project overview, architecture diagram, how account linking and room sync work
- `Penguin.md` — research on CP server software (Houdini, Waddle-Forever), client options (Ruffle, Project Aether), community history
- `VC.md` — detailed technical spec for the Discord voice integration: Houdini plugin code, Discord bot code, account linking flow, future extensions

## What's Been Done

Closed issues: #1 (README), #2 (.gitignore), #3 (env config), #4 (Docker Compose), #5 (Database Schema), #6 (Houdini Container), #7 (Discord Bot Container), #8 (Media Server), #9 (Account Linking Plugin), #11 (Dash Container), #13 (asset research).

## What To Do

The only remaining issue is:

- **#10** (Room Sync Plugin) — the final feature, unblocked by #9

### Workflow per issue

1. Read the issue and make a proper plan — ask the user questions to finalize it.
2. Replace the issue's body on GitHub with the finalized plan.
3. User approves the plan, then implementation begins in a follow-up step.

### Key context for #10

- `pending_link_codes` are in-memory on the Discord bot (not DB) — managed by `discord-bot/cogs/linking.py`
- `room_channel_mappings` table exists in DB, managed by bot admin commands (`!mapchannel`, `!unmapchannel`)
- The room sync plugin should be `houdini/plugins/discord_rooms.py` (separate from `discord_link.py`)
- Reference: `VC.md` lines 34-89 for the room sync plugin example
- Bot's `POST /move` endpoint: `{"user_id": discord_id, "channel_id": channel_id}` → moves user to voice channel

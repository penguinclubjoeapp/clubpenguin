# Next Session

## What This Project Is

A self-hosted Club Penguin private server with Discord voice integration. When a player changes rooms in-game, a Houdini plugin notifies a Discord bot which moves them to the matching voice channel. The whole stack is containerized with Docker Compose.

Key docs:
- `README.md` — project overview, architecture diagram, how account linking and room sync work
- `Penguin.md` — research on CP server software (Houdini, Waddle-Forever), client options (Ruffle, Project Aether), community history
- `VC.md` — detailed technical spec for the Discord voice integration: Houdini plugin code, Discord bot code, account linking flow, future extensions

## What's Been Done

Closed issues: #1 (README), #2 (.gitignore), #3 (env config), #4 (Docker Compose), #5 (Database Schema), #13 (asset research).

Issue #6 (Houdini container) has an open PR awaiting merge.

## What To Do

Check if the PR for #6 has been merged. If yes, the next unblocked issues are:

- **#7** (Discord Bot Container) — unblocked by #4, #5
- **#8** (Media Server Container) — unblocked by #4
- **#11** (Dash Web Service Container) — unblocked by #4

\#7 is on the critical path to voice integration (#9 → #10).

### Workflow per issue

1. Read the issue and make a proper plan — ask the user questions to finalize it.
2. Replace the issue's body on GitHub with the finalized plan.
3. User approves the plan, then implementation begins in a follow-up step.

### Tables deferred to other issues

- `room_channel_mappings` → #7 (Discord Bot Container)
- `pending_link_codes` → #9 (Account Linking Plugin)

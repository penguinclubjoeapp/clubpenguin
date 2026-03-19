# Next Session

## What This Project Is

A self-hosted Club Penguin private server with Discord voice integration. When a player changes rooms in-game, a Houdini plugin notifies a Discord bot which moves them to the matching voice channel. The whole stack is containerized with Docker Compose.

Key docs:
- `README.md` — project overview, architecture diagram, how account linking and room sync work
- `Penguin.md` — research on CP server software (Houdini, Waddle-Forever), client options (Ruffle, Project Aether), community history
- `VC.md` — detailed technical spec for the Discord voice integration: Houdini plugin code, Discord bot code, account linking flow, future extensions

## What's Been Done

Issue #1 (README) is complete and closed. Issue #13 (asset sourcing research) was split out from #1 and created. The remaining 12 issues form a dependency chain tracked on GitHub.

## What To Do

Read the GitHub issues with `gh issue list` and pick the next 2 unblocked issues from the dependency chain. Handle them in parallel using sub-agents.

For each issue: make a proper plan, ask the user questions, and once it's finalized, replace that issue's body on GitHub with the plan. Do not implement the plan — planning only.

# devhub

Terminal dashboard for multi-service development projects. Shows service health, file changes since last deploy, git status, and open PRs in a single TUI.

## Quick Start

```bash
# In your project root
devhub init        # generates hub.config.js by scanning your project
devhub             # launch the dashboard
```

Or with a config path:

```bash
devhub --config /path/to/hub.config.js
```

## Install

```bash
git clone <repo-url> devhub
cd devhub
npm install
npm link          # makes `devhub` available globally
```

## Config

`hub.config.js` in your project root:

```js
const path = require('path');

module.exports = {
    // Required
    name: 'My Project',
    root: path.resolve(__dirname),
    services: [/* see below */],

    // Optional
    github: {
        repo: 'owner/repo',       // for PR fetching via gh CLI
        remote: 'origin',
        defaultBranch: 'main',
    },
    globalTriggers: ['docker-compose.yml', '.env'],  // files that flag all services
    polling: {
        health: 5000,   // ms — service health + git status
        github: 60000,  // ms — PR fetching
    },
    stateFile: '.hub-state.json',  // tracks last restart per service
};
```

### Services

Each service in the `services` array:

```js
{
    id: 'api',                    // unique identifier
    label: 'API Server',          // display name in the TUI
    prod: {
        type: 'docker',           // 'docker' | 'process' | 'none'
        service: 'api',           // docker compose service name
        composeFile: null,        // optional, defaults to docker-compose.yml
    },
    dev: {
        type: 'process',          // detect by running process
        pattern: 'nodemon',       // pgrep -f pattern
    },
    paths: [                      // files/dirs to watch for changes
        'api/src/',
        'api/package.json',
    ],
    actions: {
        prod: {
            type: 'rebuild',      // 'rebuild' | 'restart' | 'auto'
            cmd: 'docker compose up -d --build api',
        },
        dev: {
            type: 'auto',
            message: 'nodemon auto-restarts on changes',
        },
    },
}
```

**Service types:**
- `docker` — checks `docker compose ps` for the service
- `process` — checks `pgrep -f <pattern>`
- `none` — not running in this environment

**Action types:**
- `rebuild` — runs the `cmd` (shown as "rebuild" in the Action column, triggered by `R`)
- `restart` — runs the `cmd` (shown as "restart")
- `auto` — no manual action needed, shows `message` as info

## Keybindings

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate services |
| `r` | Rebuild/restart selected service |
| `Enter` | Rebuild all pending services |
| `g` | Toggle focus to git panel (scroll with j/k) |
| `Escape` | Return focus to service list |
| `Tab` | Force refresh |
| `q` | Quit |

## CLI Args

| Arg | Description |
|-----|-------------|
| `init [dir]` | Generate a starter hub.config.js |
| `--config <path>` | Path to config file |
| `--dev` | Force dev environment detection |
| `--prod` | Force prod environment detection |

## Git Panel

The bottom panel shows:
- **Branch** — current branch with ahead/behind remote count
- **Changes** — staged, modified, and untracked file counts
- **Stash** — stash count (if any)
- **Recent Commits** — last 5 commits
- **Open PRs** — from GitHub via `gh` CLI (requires `gh auth login`)

## How It Works

The hub polls on two intervals:
- **Health poll** (default 5s) — docker/process status, git diff per service, git status
- **GitHub poll** (default 60s) — open PRs via `gh pr list`

Change detection compares the current HEAD (and working tree) against the last known restart SHA per service. When you rebuild via the hub, it records the current commit SHA so only future changes show up.

State is persisted to `.hub-state.json` in your project root (add to `.gitignore`).

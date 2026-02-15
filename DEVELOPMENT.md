# Development Guide

## Prerequisites

- Node.js v25+
- pnpm

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test
```

## Using Your Fork Locally (openclaw-emre)

This repo (`emre6943/openclaw-emre`) is a fork of `openclaw/openclaw`. To run your forked version locally instead of the published `openclaw` package:

### 1. Link the local build globally

```bash
cd location/you/cloned/this/too
pnpm build
npm link
```

This symlinks the `openclaw` binary (`/opt/homebrew/bin/openclaw`) to point at your local repo's `openclaw.mjs` entry point. Any changes you build locally will be used immediately.

### 2. Verify it's linked

```bash
openclaw --version
# Should show the version from your local build

npm ls -g openclaw
# Should show: openclaw -> ./../../../Users/emre/Developer/emre/openclaw
```

### 3. Restart the gateway to pick up changes

```bash
openclaw gateway restart
```

### Development Loop

```bash
# 1. Make your changes
# 2. Build
pnpm build
# 3. Restart gateway (picks up new build since it's npm-linked)
openclaw gateway restart
# 4. Test your changes
```

No need to re-run `npm link` after each build — the symlink persists. Just build and restart.

### Unlinking (reverting to published version)

```bash
npm unlink -g openclaw
npm install -g openclaw
```

## Build Commands

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `pnpm build`       | Full build (tsdown + plugin SDK types + UI assets) |
| `pnpm test`        | Run unit tests                                     |
| `pnpm test:e2e`    | Run end-to-end tests                               |
| `pnpm test:fast`   | Run unit tests only (faster)                       |
| `pnpm dev`         | Dev mode with hot reload                           |
| `pnpm gateway:dev` | Dev mode for gateway (skips channel init)          |
| `pnpm tui:dev`     | Dev mode for TUI                                   |
| `pnpm check`       | Type-check                                         |

## Remotes

| Remote   | URL                      | Description                 |
| -------- | ------------------------ | --------------------------- |
| `origin` | `openclaw/openclaw`      | Upstream (read-only for us) |
| `fork`   | `emre6943/openclaw-emre` | Our fork (push here)        |

```bash
# Pull upstream changes
git fetch origin
git merge origin/main

# Push your work
git push fork <branch-name>
```

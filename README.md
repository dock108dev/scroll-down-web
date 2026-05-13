# Scroll Down MLB

Spoiler-free catch-up on MLB games. Walk through the key plays one at a time and reveal the final score when you're ready.

## What This Repo Is

Single Next.js web app under [`web/`](web/). The product is an MLB-only catch-up viewer:

- **Home** — last-48h + today's MLB games, scores stripped server-side.
- **Catch-up viewer** (`/catchup/[gameId]`) — a small deck of cards that walks the user through the key plays of a game, with the final score gated behind an explicit reveal.
- **Dev tooling** (`/dev/catchup-lab`, dev-only) — runs captured fixtures through the production card pipeline for qualitative review.

The app is a thin frontend over the `sports-data-admin` backend (`sda.dock108.dev`). Server-side proxy routes inject the `X-API-Key` header so credentials never reach the browser. The backend is the source of truth for game data; the frontend builds the card deck, plans rhythm, and renders the field/runner/trajectory visuals.

The product roadmap and design intent live in [`BRAINDUMP.md`](../BRAINDUMP.md) (workspace root). Active issues live in [`.aidlc/issues/`](../.aidlc/issues/) (workspace root). Both directories live one level up because the workspace holds both this app and its `sports-data-admin` backend.

## Run Locally

Requirements: Node.js 22+.

```bash
cd web
cp .env.local.example .env.local   # set SPORTS_DATA_API_KEY
npm ci
npm run dev
```

App runs at `http://localhost:3001`.

## Deployment

```bash
cd web
npm run build   # writes standalone output to .next/standalone/
npm run start   # serves on port 3001
```

CI builds + pushes a Docker image to GHCR on every `main` push and deploys to a Hetzner dev environment. Production is promoted manually via the `Promote Prod` GitHub Actions workflow. Full pipeline: [`docs/deployment.md`](docs/deployment.md). Domain/Cloudflare/promotion mechanics: [`docs/PROD_PROMOTION_AND_COM_SETUP.md`](docs/PROD_PROMOTION_AND_COM_SETUP.md).

## Documentation

Full index: [`docs/README.md`](docs/README.md).

| Doc | Purpose |
|-----|---------|
| [`docs/architecture.md`](docs/architecture.md) | API proxy routes, catch-up pipeline, stores, hooks, security headers |
| [`docs/design.md`](docs/design.md) | Product principles and component patterns (broadcast-machine identity) |
| [`docs/development.md`](docs/development.md) | Local setup, commands, common issues, manual QA checklist |
| [`docs/deployment.md`](docs/deployment.md) | Docker build, CI/CD, Hetzner deploy |
| [`docs/testing.md`](docs/testing.md) | Vitest unit + Playwright E2E layout, scripts, CI gating |
| [`docs/state-management.md`](docs/state-management.md) | Zustand stores: settings, onboarding, catchup-progress |
| [`docs/env-and-config.md`](docs/env-and-config.md) | Environment variables and `web/src/lib/config.ts` constants |
| [`docs/PROD_PROMOTION_AND_COM_SETUP.md`](docs/PROD_PROMOTION_AND_COM_SETUP.md) | `.com` vs `.dev` domain wiring, promote-prod runbook |

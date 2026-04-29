# Scroll Down Sports

Frontend for Scroll Down Sports — a game-following experience that lets users control when scores are revealed.

## What This Repo Is

- Next.js web app (`web/`) for game feeds, game detail, FairBet odds, golf, and analytics views.
- Thin client over the `sports-data-admin` backend (`sda.dock108.dev`). API proxy routes in this repo inject credentials server-side; the backend does all data processing.

## Run Locally

Requirements: Node.js 22+

```bash
cd web
cp .env.local.example .env.local   # fill in SPORTS_DATA_API_KEY
npm ci
npm run dev
```

App runs at `http://localhost:3001`.

## Deployment

```bash
cd web
npm run build   # standalone output in .next/standalone/
npm run start
```

Docker image, GitHub Actions pipeline, and Hetzner deploy: [`docs/deployment.md`](docs/deployment.md).

## Documentation

Full index: [`docs/README.md`](docs/README.md).

| Doc | Purpose |
|-----|---------|
| [`docs/architecture.md`](docs/architecture.md) | System design: API proxy, realtime, stores, hooks, auth, security, billing, ads |
| [`docs/design.md`](docs/design.md) | Design principles, component patterns, naming conventions |
| [`docs/roadmap.md`](docs/roadmap.md) | Product phases and exit criteria |
| [`docs/development.md`](docs/development.md) | Local setup, QA checklist, common issues |
| [`docs/deployment.md`](docs/deployment.md) | Docker build, CI/CD pipeline, Hetzner deploy |
| [`docs/testing.md`](docs/testing.md) | Playwright E2E + Vitest unit tests |
| [`docs/state-management.md`](docs/state-management.md) | Zustand stores in depth |
| [`docs/realtime.md`](docs/realtime.md) | Realtime transport: WebSocket/SSE failover |
| [`docs/env-and-config.md`](docs/env-and-config.md) | Environment variables and `web/src/lib/config.ts` constants |
| [`docs/client-logic.md`](docs/client-logic.md) | Client-side patterns: score reveal, cache, analytics |
| [`docs/ADS_SETUP.md`](docs/ADS_SETUP.md) | AdSense account setup, env vars, ads.txt, paid-user suppression |

[`BRAINDUMP.md`](BRAINDUMP.md) is the customer-voice brief that drove the current rollout — read it before changing ad behavior.

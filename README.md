# Scroll Down Sports

Frontend for Scroll Down Sports — a game-following experience that lets users control when scores are revealed.

## What This Repo Is

- Next.js web app (`web/`) for game feeds, game detail, FairBet odds, golf, and analytics views.
- Thin client over the `sports-data-admin` backend (`sda.dock108.dev`). API proxy routes in this repo inject credentials server-side; the backend does all data processing.

## Run Locally

Requirements: Node.js 22+

```bash
cd web
cp .env.local.example .env.local   # fill in API keys
npm ci
npm run dev
```

App runs at `http://localhost:3001`.

## Deployment

```bash
cd web
npm run build   # standalone output in standalone/
npm run start
```

Docker and CI/CD details: [`docs/deployment.md`](docs/deployment.md)

## Documentation

| Doc | Purpose |
|-----|---------|
| [`docs/architecture.md`](docs/architecture.md) | API proxy, realtime transport, Zustand stores, auth, security |
| [`docs/design.md`](docs/design.md) | Design principles, component patterns, naming conventions |
| [`docs/roadmap.md`](docs/roadmap.md) | Product phases and exit criteria |
| [`docs/development.md`](docs/development.md) | Local setup, QA checklist, common issues |
| [`docs/deployment.md`](docs/deployment.md) | Docker build, CI/CD pipeline, Hetzner deploy |
| [`docs/testing.md`](docs/testing.md) | Playwright E2E: helpers, test suites, resilience patterns |
| [`docs/state-management.md`](docs/state-management.md) | Zustand stores in depth: shape, persistence, preference sync |
| [`docs/realtime.md`](docs/realtime.md) | Realtime transport: WebSocket/SSE failover, subscriptions |
| [`docs/env-and-config.md`](docs/env-and-config.md) | Environment variables and `src/lib/config.ts` constants |
| [`docs/client-logic.md`](docs/client-logic.md) | Client-side patterns: score reveal, cache, analytics, etc. |
| [`docs/`](docs/README.md) | Full docs index |

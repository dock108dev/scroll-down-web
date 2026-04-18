# Scroll Down Sports Web

Frontend for Scroll Down Sports, a game-following experience that lets users control when scores are revealed.

## What This Repo Is

- Next.js web app (`web/`) for game feeds, game detail, FairBet, golf, and analytics views.
- Thin client over the `sports-data-admin` backend (API proxy routes live in this repo, backend service does the heavy data processing).

## Run Locally

Requirements:
- Node.js 22+

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

App runs at `http://localhost:3001`.

## Deployment Basics

- Production build:

```bash
cd web
npm run build
npm run start
```

- Docker and CI workflow details are documented in `docs/deployment.md`.

## More Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — System design: API proxy, realtime, stores, auth, security
- [`DESIGN.md`](DESIGN.md) — Design principles, component patterns, naming conventions
- [`ROADMAP.md`](ROADMAP.md) — Product roadmap and phase planning
- [`docs/`](docs/README.md) — Full index: development setup, deployment, testing, state management, realtime, audits

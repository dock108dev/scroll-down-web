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

All deeper docs are in [`docs/`](docs/), including architecture, development setup, deployment, testing, realtime behavior, and state management.

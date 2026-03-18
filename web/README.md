# Scroll Down Sports — Web

Next.js frontend for Scroll Down Sports. Displays live game scores, play-by-play timelines, betting odds analysis (FairBet), and MLB analytics tools. Connects to a backend API for all data; this repo contains no database or scraping logic.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| UI | React 19, Tailwind CSS 4 |
| State | Zustand 5 with localStorage persistence |
| Realtime | WebSocket primary, SSE fallback |
| Testing | Playwright (Chromium + mobile viewport) |
| Deploy | Docker (Node 22 Alpine) on Hetzner, CI via GitHub Actions |

## Quickstart

```bash
# 1. Install dependencies
npm ci

# 2. Create local env file
cp .env.local.example .env.local
# Edit .env.local — set SPORTS_DATA_API_KEY

# 3. Run dev server (port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Playwright E2E tests |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:headed` | Tests in visible browser |

## Project Structure

```
src/
  app/            # Next.js App Router pages + API proxy routes
  components/     # React components by feature area
  features/       # Self-contained feature modules (analytics)
  hooks/          # Custom React hooks (data fetching, display logic)
  lib/            # Utilities, config, types, API wrappers
  realtime/       # WebSocket/SSE transport + event dispatcher
  stores/         # Zustand state stores
tests/            # Playwright E2E test suites
```

## Key Pages

| Route | Description | Access |
|-------|------------|--------|
| `/` | Game list (today + yesterday) with scores, pins, filters | Public |
| `/game/[id]` | Game detail: timeline, stats, odds, flow narrative | Public |
| `/fairbet` | Betting odds analysis with EV calculations | Pre-game public, live auth-gated |
| `/analytics` | Sports analytics hub | Auth required |
| `/analytics/simulator` | MLB Monte Carlo lineup simulator | Auth required |
| `/analytics/profiles` | Team performance profiles with rolling windows | Auth required |
| `/analytics/models` | Model management, training, and calibration | Admin only |
| `/analytics/batch` | Batch simulations and prediction outcomes | Admin only |
| `/analytics/experiments` | Experiment suites with variant comparison | Admin only |
| `/history` | Historical games browser | Admin only |
| `/profile` | Account management | Auth required |
| `/login` | Login / signup / magic link | Public |

## Documentation

Detailed docs live in [`/docs`](../docs/):

- [Architecture](../docs/architecture.md) — system design, data flow, component structure
- [Environment & Config](../docs/env-and-config.md) — env vars, tunables, storage keys
- [Realtime System](../docs/realtime.md) — WebSocket/SSE transport, event handling, recovery
- [State Management](../docs/state-management.md) — Zustand stores, persistence, preference sync
- [Deployment](../docs/deployment.md) — Docker, CI/CD pipeline, production setup
- [Testing](../docs/testing.md) — Playwright E2E test setup and patterns
- [Client-Side Logic](../docs/client-logic.md) — what intentionally stays in-browser
- [Development](../docs/development.md) — local dev setup, debugging, QA checklist

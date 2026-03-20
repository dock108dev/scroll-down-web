# Scroll Down Sports — Web

Web client for **Scroll Down Sports** — catch up on games without immediate score reveals.

## The Concept

Sports fans don't always watch games live. Most apps immediately show final scores — robbing you of the experience of following how the game unfolded.

**Scroll Down** takes a different approach:
- **Pace yourself.** Move through key moments in order
- **Context first.** See matchups and game flow before outcomes
- **Reveal on your terms.** You decide when to uncover scores

## Quick Start

**Requirements:** Node 22+

```bash
cd web
cp .env.local.example .env.local   # Add your API key
npm install
npm run dev                         # http://localhost:3001
```

## Features

| Feature | Status |
|---------|--------|
| Home feed (Yesterday / Today) | Yes |
| Game history browsing by date range | Yes |
| Game search by team name | Yes |
| Game detail with collapsible sections | Yes |
| Flow-based narrative timeline | Yes |
| Tiered play-by-play | Yes |
| Cross-book odds table | Yes |
| PGA Tour golf tournaments and leaderboards | Yes |
| FairBet odds comparison with EV (Pre-Game) | Yes |
| FairBet live odds with closing line + movement history | Yes |
| Parlay builder with client-side evaluation | Yes |
| MLB PA Simulator (lineup-aware Monte Carlo, Statcast-powered) | Yes |
| MLB Team Profiles with rolling windows | Yes |
| Model management, training, and calibration (admin) | Yes |
| Batch simulation and outcome tracking (admin) | Yes |
| Server-synced user preferences (settings, pins, reveals) | Yes |
| User authentication (login, signup, forgot password, profile) | Yes |
| Role-based access (guest / user / admin) | Yes |
| Score reveal preference (spoiler-free) | Yes |
| Reading position tracking with resume | Yes |
| Theme selection (system / light / dark) | Yes |
| Realtime updates (WebSocket primary, SSE fallback) | Yes |
| NHL skater / goalie stats | Yes |
| Pinned games (up to 10, mini scores in header) | Yes |
| AI agent audit infrastructure (Playwright + scripts) | Yes |

## Architecture

The app is a **thin display layer**. The backend (`sports-data-admin.dock108.ai`) computes all derived data — period labels, play tiers, odds outcomes, team colors, merged timelines, EV calculations. The client reads pre-computed values and renders them. No backend code lives in this repository.

```
Browser (React)
    ├─ fetch("/api/games")          → Next.js API Route → Backend API → JSON response
    ├─ fetch("/api/auth/login")     → Next.js Auth Proxy → Backend /auth/* → JWT token
    └─ WebSocket/SSE realtime       → Backend /v1/ws or /v1/sse → Event patches
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Zustand 5** for state management (persisted to localStorage)
- **Tailwind CSS 4** for styling
- **Docker** (node:22-alpine multi-stage) for deployment

## Documentation

All detailed documentation lives in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture, data flow, realtime layer, state management |
| [Environment & Config](docs/env-and-config.md) | Environment variables, tunables, storage keys |
| [Realtime System](docs/realtime.md) | WebSocket/SSE transport, event handling, recovery |
| [State Management](docs/state-management.md) | Zustand stores, persistence, preference sync |
| [Deployment](docs/deployment.md) | Docker, CI/CD pipeline, production setup |
| [Testing](docs/testing.md) | Playwright E2E test setup, audit suite, and patterns |
| [Client-Side Logic](docs/client-logic.md) | What intentionally stays in-browser |
| [Development](docs/development.md) | Local dev setup, debugging, QA checklist |
| [Audit Mac Setup](docs/AUDIT-MAC-SETUP.md) | Headless Mac setup for continuous AI-driven auditing |

## Repository Layout

```
web/             # Next.js web application (active, deployed)
  src/
    app/         # Pages + API proxy routes
    components/  # UI components by feature
    features/    # Self-contained feature modules (analytics)
    hooks/       # Data fetching hooks
    stores/      # Zustand state stores
    realtime/    # WebSocket/SSE transport layer
    lib/         # Types, utilities, config
  tests/         # Playwright E2E test suites
scripts/         # Audit orchestration scripts
docs/            # Documentation
.github/         # CI/CD workflows
```

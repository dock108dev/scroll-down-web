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
| FairBet odds comparison with EV (Pre-Game) | Yes |
| FairBet live odds with closing line + movement history | Yes |
| Parlay builder with client-side evaluation | Yes |
| Score reveal preference (spoiler-free) | Yes |
| Reading position tracking with resume | Yes |
| Theme selection (system / light / dark) | Yes |
| Realtime updates (WebSocket primary, SSE fallback) | Yes |
| NHL skater / goalie stats | Yes |
| Pinned games (up to 10, mini scores in header) | Yes |

## Architecture

The app is a **thin display layer**. The backend (`sports-data-admin.dock108.ai`) computes all derived data — period labels, play tiers, odds outcomes, team colors, merged timelines, EV calculations. The client reads pre-computed values and renders them. No backend code lives in this repository.

```
Browser (React)
    ├─ fetch("/api/games")          → Next.js API Route → Backend API → JSON response
    └─ WebSocket/SSE realtime       → Backend /v1/ws or /v1/sse → Event patches
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Zustand 5** for state management (persisted to localStorage)
- **Tailwind CSS 4** for styling
- **Docker** (node:22-alpine multi-stage) for deployment

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture, data flow, realtime layer, state management |
| [Development](docs/development.md) | Local dev setup, debugging, QA checklist |
| [Client-Side Logic](docs/client-logic.md) | What intentionally stays in-browser |
| [CI/CD & Deployment](docs/ci-cd.md) | GitHub Actions, Docker, Hetzner deployment |

## Repository Layout

```
web/             # Next.js web application (active, deployed)
docs/            # Documentation
.github/         # CI/CD workflows
```

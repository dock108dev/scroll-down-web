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
npm run dev                         # http://localhost:3000
```

## Features

| Feature | Status |
|---------|--------|
| Home feed (Earlier / Yesterday / Today / Tomorrow) | Yes |
| Game search by team name | Yes |
| Game detail with collapsible sections | Yes |
| Flow-based narrative timeline | Yes |
| Tiered play-by-play | Yes |
| Cross-book odds table | Yes |
| FairBet odds comparison with EV | Yes |
| Score reveal preference (spoiler-free) | Yes |
| Reading position tracking with resume | Yes |
| Theme selection (system / light / dark) | Yes |
| Live game auto-polling | Yes |
| NHL skater / goalie stats | Yes |
| Parlay builder with server-side evaluation | Yes |

## Architecture

The app is a **thin display layer**. The backend (`sports-data-admin.dock108.ai`) computes all derived data — period labels, play tiers, odds outcomes, team colors, merged timelines. The client reads pre-computed values and renders them. No backend code lives in this repository.

```
Browser (React)
    ↓ fetch("/api/games")
Next.js API Route (server-side)
    ↓ apiFetch() with X-API-Key header
Backend API (sports-data-admin.dock108.ai)
    ↓ JSON response
Next.js API Route
    ↓ NextResponse.json()
Browser → React hook → Component re-render
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Zustand 5** for state management (persisted to localStorage)
- **Tailwind CSS 4** for styling
- **Docker** (node:22-alpine multi-stage) for deployment

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture and data flow |
| [Development](docs/development.md) | Local dev, testing, debugging |
| [CI/CD](docs/ci-cd.md) | GitHub Actions, Docker, deployment |
| [Client-Side Logic](web/APP_LOGIC.md) | What intentionally stays in-browser |

## Repository Layout

```
web/             # Next.js web application (active, deployed)
webapp/          # Legacy vanilla HTML/JS/CSS prototype (superseded, not deployed)
docs/            # Documentation
.github/         # CI/CD workflows
```

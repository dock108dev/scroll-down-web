# Scroll Down Sports — Web

Web client for **Scroll Down Sports** — catch up on games without immediate score reveals.

## The Concept

Sports fans don't always watch games live. Most apps immediately show final scores — robbing you of the experience of following how the game unfolded.

**Scroll Down** takes a different approach:
- **Pace yourself.** Move through key moments in order
- **Context first.** See matchups and game flow before outcomes
- **Reveal on your terms.** You decide when to uncover scores

## Platforms

| Platform | Directory | Tech Stack | Status |
|----------|-----------|------------|--------|
| Web | `web/` | Next.js 16, React 19, Zustand, Tailwind | Live |

The web client consumes the same backend API (`sports-data-admin.dock108.ai`). No backend code lives in this repository — it is purely a client layer.

`webapp/` contains a legacy vanilla HTML/JS/CSS prototype, superseded by the Next.js web app.

## Quick Start

**Requirements:** Node 22+

```bash
cd web
cp .env.local.example .env.local   # Add your API key
npm install
npm run dev                         # http://localhost:3000
```

## Features

| Feature | Web |
|---------|-----|
| Home feed (Earlier/Yesterday/Today/Tomorrow) | Yes |
| Game search by team name | Yes |
| Game detail with collapsible sections | Yes |
| Flow-based narrative timeline | Yes |
| Tiered play-by-play | Yes |
| Cross-book odds table | Yes |
| FairBet odds comparison with EV | Yes |
| Score reveal preference (spoiler-free) | Yes |
| Reading position tracking with resume | Yes |
| Theme selection (system/light/dark) | Yes |
| Live game auto-polling | Yes |
| NHL skater/goalie stats | Yes |

## Architecture

The app is a **thin display layer**. The backend computes all derived data — period labels, play tiers, odds outcomes, team colors, merged timelines. The client reads pre-computed values and renders them.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture and data flow |
| [Development](docs/development.md) | Local dev, testing, debugging |
| [CI/CD](docs/ci-cd.md) | GitHub Actions, Docker, deployment |

Client-side logic catalog:
- [Web APP_LOGIC.md](web/APP_LOGIC.md) — What intentionally stays in-browser

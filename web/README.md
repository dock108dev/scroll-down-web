# Scroll Down — Web App

Next.js 16 web frontend for Scroll Down Sports. Deployed to Hetzner via Docker.

## Quick Start

```bash
cp .env.local.example .env.local   # Add your SPORTS_DATA_API_KEY
npm install
npm run dev                         # http://localhost:3001
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Zustand 5** for state management (persisted to localStorage)
- **Tailwind CSS 4** for styling
- **Docker** (node:22-alpine multi-stage) for deployment

## Project Structure

```
src/
├── app/              # Pages + API proxy routes
│   ├── page.tsx      # Home (game feed)
│   ├── game/[id]/    # Game detail
│   ├── fairbet/      # FairBet odds comparison
│   ├── settings/     # User preferences
│   └── api/          # Server-side API proxies
├── components/       # React components (home, game, fairbet, layout, shared)
├── hooks/            # Data fetching hooks (useGames, useGame, useFlow, useFairBetOdds)
├── stores/           # Zustand stores (settings, read-state, reading-position, section-layout, pinned-games, ui)
└── lib/              # Types, API clients, utilities, constants
```

## Architecture

The web app is a **thin display layer**. All game data, EV calculations, and derived metrics come from the backend API. The Next.js API routes (`/api/*`) proxy requests to the backend, keeping the API key server-side.

For full documentation, see the [main README](../README.md) and [Architecture](../docs/architecture.md).

Client-side logic catalog: [client-logic.md](../docs/client-logic.md)

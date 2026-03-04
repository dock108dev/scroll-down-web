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
├── app/
│   ├── page.tsx              # Home page (game feed)
│   ├── game/[id]/page.tsx    # Game detail
│   ├── fairbet/page.tsx      # FairBet odds comparison
│   ├── settings/page.tsx     # User preferences
│   └── api/                  # Server-side API proxy routes (4 routes)
├── components/
│   ├── home/                 # GameRow, TimelineSection, SearchBar, PinnedBar
│   ├── game/                 # GameHeader, FlowContainer, TimelineSection, StatsSection,
│   │                         # OddsSection, MiniScorebar, WrapUpSection, PregameBuzzSection, etc.
│   ├── fairbet/              # BetCard, BookFilters, FairExplainerSheet, ParlaySheet
│   ├── settings/             # SettingsContent
│   ├── layout/               # TopNav, BottomTabs, ThemeProvider, SettingsDrawer
│   └── shared/               # LoadingSkeleton, CollapsibleCard, SectionHeader
├── hooks/
│   ├── useGamesList.ts       # Home feed: date sections, 60s auto-refresh, client search
│   ├── useGameDetail.ts      # Game detail: 5-min LRU cache, 45s live polling
│   ├── useGameFlow.ts        # Game flow: narrative blocks, background refresh
│   ├── useFairBetOdds.ts     # FairBet: pagination, filtering, sorting, parlay
│   └── useScoreDisplay.ts    # Score reveal/hide display logic
├── stores/
│   ├── settings.ts           # Theme, odds format, score reveal, section expansion
│   ├── reveal.ts             # Score reveal state with frozen snapshots (persisted)
│   ├── reading-position.ts   # Per-game scroll position with score snapshot
│   ├── section-layout.ts     # Game detail section collapse/expand state
│   ├── pinned-games.ts       # User-pinned games for quick access
│   ├── game-data.ts          # Normalized game data cache (in-memory)
│   ├── home-scroll.ts        # Home page scroll position (in-memory)
│   └── ui.ts                 # Transient UI state (drawers, sheets)
└── lib/
    ├── types.ts              # All TypeScript interfaces (GameSummary, APIBet, FlowBlock, etc.)
    ├── api.ts                # Client-side fetch wrapper (browser → /api/* proxy routes)
    ├── api-server.ts         # Server-side fetch with X-API-Key header, UTF-8 mojibake repair
    ├── config.ts             # Centralized app constants (cache TTLs, polling, API, storage keys)
    ├── utils.ts              # Date formatting, odds conversion, team name display
    ├── fairbet-utils.ts      # EV colors, confidence labels, market labels, bet enrichment
    ├── score-display.ts      # Score visibility logic (reveal/freeze/update)
    ├── storage-bounds.ts     # Storage pruning utilities (max entries, max age)
    ├── theme.ts              # FairBet theme constants, book abbreviation utility
    └── team-stats-config.ts  # Sport-specific stat groupings and comparison logic
```

## Architecture

The web app is a **thin display layer**. All game data, EV calculations, and derived metrics come from the backend API. The Next.js API routes (`/api/*`) proxy requests to the backend, keeping the API key server-side.

For full documentation, see the [main README](../README.md) and [Architecture](../docs/architecture.md).

Client-side logic catalog: [client-logic.md](../docs/client-logic.md)

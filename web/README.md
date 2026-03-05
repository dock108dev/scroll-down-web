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

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home page (game feed)
│   ├── game/[id]/page.tsx    # Game detail
│   ├── fairbet/page.tsx      # FairBet odds (Pre-Game + Live tabs)
│   ├── history/page.tsx      # Historical game browsing
│   ├── settings/page.tsx     # User preferences
│   └── api/                  # Server-side API proxy routes (5 routes)
├── components/
│   ├── home/                 # GameRow, TimelineSection, SearchBar, PinnedBar
│   ├── game/                 # GameHeader, FlowContainer, TimelineSection, StatsSection,
│   │                         # OddsSection, MiniScorebar, WrapUpSection, PregameBuzzSection, etc.
│   ├── fairbet/              # BetCard, BookFilters, FairExplainerSheet, ParlaySheet, LiveOddsPanel
│   ├── history/              # DateNavigator
│   ├── settings/             # SettingsContent
│   ├── layout/               # TopNav, BottomTabs, ThemeProvider, SettingsDrawer, RealtimeProvider
│   └── shared/               # LoadingSkeleton, CollapsibleCard, SectionHeader
├── hooks/
│   ├── useGamesList.ts       # Home feed: realtime patches, visibility-driven refresh
│   ├── useGameDetail.ts      # Game detail: realtime patches, visibility-driven refresh
│   ├── useGameFlow.ts        # Game flow: narrative blocks, background refresh
│   ├── useFairBetOdds.ts     # FairBet pre-game: pagination, filtering, sorting, parlay
│   ├── useFairBetLive.ts     # FairBet live: per-game live odds with 15s polling
│   ├── useHistoricalGames.ts # History: paginated games by date range
│   └── useScoreDisplay.ts    # Score reveal/hide display logic
├── realtime/
│   ├── transport.ts          # WebSocket + SSE transport singleton
│   ├── dispatcher.ts         # Centralized event routing with seq/gap handling
│   ├── channels.ts           # Channel naming helpers
│   ├── useRealtimeSubscription.ts  # Declarative channel subscription hook
│   └── useRealtimeStatus.ts  # Transport status sync to Zustand
├── stores/
│   ├── settings.ts           # Theme, odds format, score reveal, section expansion
│   ├── reveal.ts             # Score reveal state with frozen snapshots (persisted)
│   ├── reading-position.ts   # Per-game scroll position with score snapshot
│   ├── section-layout.ts     # Game detail section collapse/expand state
│   ├── pinned-games.ts       # User-pinned games for quick access
│   ├── game-data.ts          # Normalized game data cache + realtime state (in-memory)
│   ├── home-scroll.ts        # Home page scroll position (in-memory)
│   └── ui.ts                 # Transient UI state (drawers, sheets)
└── lib/
    ├── types.ts              # All TypeScript interfaces
    ├── api.ts                # Client-side fetch wrapper (browser → /api/* proxy routes)
    ├── api-server.ts         # Server-side fetch with X-API-Key header, UTF-8 mojibake repair
    ├── config.ts             # Centralized app constants
    ├── utils.ts              # Date formatting, odds conversion, team name display
    ├── fairbet-utils.ts      # EV colors, confidence labels, market labels, bet enrichment
    ├── score-display.ts      # Score visibility logic (reveal/freeze/update)
    ├── storage-bounds.ts     # Storage pruning utilities (max entries, max age)
    ├── theme.ts              # FairBet theme constants
    └── team-stats-config.ts  # Sport-specific stat groupings and comparison logic
```

For full documentation, see the [main README](../README.md) and [docs/](../docs/).

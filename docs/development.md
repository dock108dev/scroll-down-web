# Development

Guide for local development, testing, and debugging.

---

## Setup

```bash
cd web
cp .env.local.example .env.local   # Add your SPORTS_DATA_API_KEY
npm install
npm run dev                         # http://localhost:3001
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend API base URL (default: `https://sports-data-admin.dock108.ai`) |
| `SPORTS_DATA_API_KEY` | Yes | API authentication. Server-side only — never exposed to browser. |

See `web/.env.local.example` for local development defaults.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |

## Docker (Local)

```bash
cd web
docker build -t scrolldown-web .
docker run -p 3001:3001 --env-file .env.local scrolldown-web
```

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
│   ├── home/                 # GameSection, GameCard, SearchBar, PinnedBar
│   ├── game/                 # GameHeader, FlowContainer, TimelineSection, PlayerStatsSection,
│   │                         # TeamStatsSection, OddsSection, WrapUpSection, etc.
│   ├── fairbet/              # BetCard, BookFilters, FairExplainerSheet, ParlaySheet
│   ├── settings/             # SettingsContent
│   ├── layout/               # TopNav, BottomTabs, ThemeProvider, SettingsDrawer
│   └── shared/               # LoadingSkeleton, CollapsibleCard, SectionHeader, TeamColorDot
├── hooks/
│   ├── useGames.ts           # Home feed: date sections, 60s auto-refresh, client search
│   ├── useGame.ts            # Game detail: 5-min LRU cache, 45s live polling
│   ├── useFlow.ts            # Game flow: fetch-once
│   └── useFairBetOdds.ts     # FairBet: pagination, filtering, sorting, parlay
├── stores/
│   ├── settings.ts           # Theme, odds format, score reveal, section expansion
│   ├── read-state.ts         # Which games user has read (Set<gameId>)
│   ├── reading-position.ts   # Per-game scroll position with score snapshot
│   ├── section-layout.ts     # Game detail section collapse/expand state
│   ├── pinned-games.ts       # User-pinned games for quick access
│   └── ui.ts                 # Transient UI state (drawers, sheets, modals)
└── lib/
    ├── types.ts              # All TypeScript interfaces (GameSummary, APIBet, FlowBlock, etc.)
    ├── api.ts                # Client-side fetch wrapper (browser → /api/* proxy routes)
    ├── api-server.ts         # Server-side fetch with X-API-Key header
    ├── utils.ts              # Date formatting, odds conversion, team name display
    ├── fairbet-utils.ts      # EV colors, confidence labels, market labels, bet enrichment
    ├── theme.ts              # FairBet theme constants, book abbreviation utility
    └── team-stats-config.ts  # Sport-specific stat groupings and comparison logic
```

## How Data Flows

1. **Browser** calls a client-side API function (e.g., `api.games()`)
2. Request goes to a **Next.js API route** (e.g., `/api/games`)
3. The API route calls the **backend** with `apiFetch()`, which adds the `X-API-Key` header
4. Response flows back through the same chain
5. A **React hook** (`useGames`, `useGame`, etc.) stores the data in state
6. **Components** render from hook state and Zustand stores

The API key never leaves the server. Client-side code only talks to local `/api/*` routes.

## Key Behaviors to Understand

### Score Reveal
- Default mode (`onMarkRead`): scores hidden until user taps to reveal
- `always` mode: scores always visible
- Revealed live game scores **freeze** at the moment of reveal
- When a live game goes final while frozen, scores auto-hide

### Live Polling
- `useGame`: 45s polling when game is `in_progress` or `live`. Silent refresh (no loading spinner).
- `useGames`: 60s auto-refresh. Pauses when tab is hidden, resumes immediately on focus.

### FairBet Loading
- First 100 bets render immediately
- Remaining pages load in background (3 concurrent fetches)
- Client filters, sorts, and deduplicates the full bet list
- Parlay evaluation is client-side (`parlayProbIndependent()` in `fairbet-utils.ts`)

### Theming
- CSS variable system: `:root` = light, `.dark` = dark
- `ThemeProvider` toggles `.dark` class on `<html>`
- Uses `@theme` (not `@theme inline`) in Tailwind CSS 4 so utilities reference CSS variables
- FairBet has dedicated `--fb-*` CSS variables

## QA Checklist

### Home Page
- [ ] Date sections render (Earlier, Yesterday, Today, Tomorrow)
- [ ] League filter works (All, NBA, NCAAB, NFL, NCAAF, MLB, NHL)
- [ ] Search filters by team name
- [ ] Game cards navigate to game detail
- [ ] Section expand/collapse persists
- [ ] "Mark All Read" bulk action works
- [ ] Scores respect reveal mode setting

### Game Detail
- [ ] Sections render based on status (Overview, Flow, Timeline, Player Stats, Team Stats, Odds, Wrap-Up)
- [ ] Flow blocks display for completed games
- [ ] Timeline shows tiered plays for live games
- [ ] Odds table shows cross-book comparison with category tabs
- [ ] NHL games show skater/goalie stats instead of generic player stats
- [ ] Reading position saves on scroll and restores on return
- [ ] Score freeze works for revealed live games (frozen scores, amber dot on new data)

### FairBet
- [ ] Odds load with progressive pagination
- [ ] BetCard shows EV, fair odds, book chips
- [ ] FairExplainer sheet opens with method explanation
- [ ] Filters work (league, market, +EV only, search)
- [ ] Parlay builder works (select bets, client-side evaluation)

### Settings
- [ ] Theme toggle works (system, light, dark)
- [ ] Score reveal mode toggle works
- [ ] Odds format toggle works

### Cross-Cutting
- [ ] Light and dark themes display correctly
- [ ] No hardcoded white/dark colors in light mode
- [ ] Loading skeletons appear during data fetch
- [ ] Empty states show contextual messages
- [ ] Error states show retry button

## Common Issues

**API errors (500):**
- Check `SPORTS_DATA_API_KEY` is set in `.env.local`
- Check `NEXT_PUBLIC_API_BASE_URL` points to a running backend
- Check browser Network tab for the failing `/api/*` request

**Stale data after code changes:**
- `npm run dev` hot-reloads components but API route changes may need a server restart
- Delete `.next/` directory for a clean build if caching issues persist

**Type errors:**
- Run `npx tsc --noEmit` to check all types
- Web types are in `web/src/lib/types.ts` — keep in sync with API responses

**Light mode issues:**
- Ensure `@theme` (not `@theme inline`) in `globals.css` — inline mode hardcodes values instead of using CSS variables
- Check for hardcoded `text-white`, `bg-white`, or inline `style={{ color: "white" }}` — use `text-neutral-50`, `bg-neutral-50`, or `var(--ds-text-primary)` instead
- FairBet components should use `var(--fb-*)` CSS variables, not `FairBetTheme.*` TypeScript constants for backgrounds/borders

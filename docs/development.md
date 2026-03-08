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
| `npm run dev` | Development server with hot reload (port 3001) |
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

## How Data Flows

1. **Browser** calls a client-side API function (e.g., `api.games()`)
2. Request goes to a **Next.js API route** (e.g., `/api/games`)
3. The API route calls the **backend** with `apiFetch()`, which adds the `X-API-Key` header
4. Response flows back through the same chain
5. A **React hook** (`useGamesList`, `useGameDetail`, etc.) stores the data in state
6. **Components** render from hook state and Zustand stores

For live games, realtime updates arrive via WebSocket/SSE and are applied directly to the Zustand store by the centralized dispatcher. Components re-render automatically.

The API key never leaves the server. Client-side code only talks to local `/api/*` routes.

## Key Behaviors

### Score Reveal
- Default mode (`onMarkRead`): scores hidden until user taps to reveal
- `always` mode: scores always visible
- Revealed live game scores **freeze** at the moment of reveal
- When a live game goes final while frozen, scores auto-hide

### Realtime Updates
- WebSocket primary transport, SSE fallback after repeated WS failures
- Centralized dispatcher routes events by type (game patches, PBP appends, FairBet refreshes)
- Sequence-numbered events with gap detection and recovery
- Visibility-driven refresh when tab regains focus while offline
- Enable debug logging: set `REALTIME.DEBUG = true` in `lib/config.ts`

### FairBet Loading
- Pre-Game tab: first 100 bets render immediately, remaining pages load in background (3 concurrent fetches)
- Live tab: per-game live odds with 15s auto-refresh
- Client filters, sorts, and deduplicates the full pre-game bet list
- Parlay evaluation is client-side (`parlayProbIndependent()` in `fairbet-utils.ts`)

### Theming
- CSS variable system: `:root` = light, `.dark` = dark
- `ThemeProvider` toggles `.dark` class on `<html>`
- Uses `@theme` (not `@theme inline`) in Tailwind CSS 4 so utilities reference CSS variables
- FairBet has dedicated `--fb-*` CSS variables

## QA Checklist

### Home Page
- [ ] Date sections render (Yesterday, Today)
- [ ] League filter works (All, NBA, NCAAB, NFL, NCAAF, MLB, NHL)
- [ ] Search filters by team name
- [ ] Game rows navigate to game detail
- [ ] Pin/unpin games from rows (star icon)
- [ ] Pinned games appear in header bar with mini scores
- [ ] Section expand/collapse persists
- [ ] "Mark All Read" bulk action works
- [ ] Scores respect reveal mode setting

### Game Detail
- [ ] Sections render based on status (Pregame Buzz, Flow, Timeline, Player Stats, Team Stats, Odds, Wrap-Up)
- [ ] Flow blocks display for completed games
- [ ] Timeline shows tiered plays for live games
- [ ] Odds table shows cross-book comparison with category tabs
- [ ] NHL games show skater/goalie stats instead of generic player stats
- [ ] Reading position saves on scroll and restores on return
- [ ] Score freeze works for revealed live games (frozen scores, amber dot on new data)
- [ ] Mini scorebar appears when scrolling past header

### MLB Matchup Simulator (`/analytics`)
- [ ] Team dropdowns populate from API
- [ ] Simulation runs with two different teams selected
- [ ] Win probability bars render with correct percentages
- [ ] Expected scores and O/U display
- [ ] Most likely final scores display as ranked cards
- [ ] PA probability profiles show for both teams when profiles are loaded
- [ ] "Using league-average defaults" warning appears when profiles are not loaded
- [ ] What Happens Next: outcome overlay shows correct label and probability
- [ ] Back navigation ("All Tools") returns to app grid
- [ ] Simulation results cache per game (no duplicate API calls on re-open)

### FairBet
- [ ] Pre-Game tab: odds load with progressive pagination
- [ ] BetCard shows EV, fair odds, book chips
- [ ] FairExplainer sheet opens with method explanation
- [ ] Filters work (league, market, +EV only, search)
- [ ] Parlay builder works (select bets, client-side evaluation)
- [ ] Live tab: game picker populates with live games
- [ ] Live tab: closing lines, live snapshot, and history display
- [ ] Live tab: auto-refreshes every 15s

### History
- [ ] Date navigator works (start/end date selection)
- [ ] League filter works
- [ ] Search filters by team name
- [ ] Sort modes work (Away, Home, Time)
- [ ] Infinite scroll loads more games
- [ ] URL params persist across navigation

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
- [ ] Realtime connection indicator (green dot on FairBet page)

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
- Ensure `@theme` (not `@theme inline`) in `globals.css`
- Check for hardcoded `text-white`, `bg-white`, or inline `style={{ color: "white" }}` — use `text-neutral-50`, `bg-neutral-50`, or `var(--ds-text-primary)` instead
- FairBet components should use `var(--fb-*)` CSS variables for backgrounds/borders

**Realtime not connecting:**
- Check browser console for WebSocket connection errors
- Verify backend is running and `/v1/ws` endpoint is accessible
- Enable debug logging: set `REALTIME.DEBUG = true` in `lib/config.ts`
- Check the green/gray dot on the FairBet page for connection status

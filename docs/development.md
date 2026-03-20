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
| `SPORTS_DATA_API_KEY` | Yes | API authentication sent as `X-API-Key` header. Server-side only — never exposed to browser. |
| `SPORTS_API_INTERNAL_URL` | No | Override backend URL for server-side fetches. Default: `https://sports-data-admin.dock108.ai` (hardcoded in `src/lib/config.ts`). |

See `.env.local.example` for local development defaults.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload (port 3001) |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |
| `npm run test:audit` | Run audit test suite |
| `npm run test:audit:report` | Audit tests + markdown report |

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
- Visibility-driven refresh when tab regains focus: triggers if hidden >5 seconds *or* if realtime is offline (via `useVisibilityRefresh` hook)
- Enable debug logging: set `REALTIME.DEBUG = true` in `lib/config.ts`

### FairBet Loading
- Pre-Game tab: first 100 bets render immediately, remaining pages load in background (3 concurrent fetches)
- Live tab: discovers all live games, fetches odds in parallel with 15s auto-refresh
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

### Analytics Landing (`/analytics`)
- [ ] MLB card renders and navigates to `/analytics/simulator`
- [ ] AuthGate blocks guests with signup prompt

### Analytics Tab Navigation
- [ ] Tab bar visible on all analytics sub-pages (Simulator, Profiles, Models, Batch Sims)
- [ ] Active tab highlighted with blue underline
- [ ] Non-admin users see only Simulator and Profiles tabs
- [ ] Admin users see all 4 tabs
- [ ] `/analytics/mlb` redirects to `/analytics/simulator`

### MLB PA Simulator (`/analytics/simulator`)
- [ ] Team dropdowns populate from API (no duplicate abbreviations across sports)
- [ ] Selecting a team loads its roster (batters + pitchers)
- [ ] LineupBuilder auto-fills top 9 batters and top pitcher per team
- [ ] User can swap batters and reorder lineup
- [ ] User can change starting pitcher
- [ ] Starter innings hardcoded to 6 (no UI slider)
- [ ] Simulation requires both 9-man lineups + both starters selected
- [ ] Simulation runs and shows lineup mode badge
- [ ] Win probability bars render with correct percentages
- [ ] Expected scores and O/U display
- [ ] Most likely final scores display (top 5) as ranked cards
- [ ] PA probability profiles show for both teams
- [ ] AuthGate blocks guests with signup prompt

### Team Profiles (`/analytics/profiles`)
- [ ] Team selector populates from API
- [ ] Rolling window selector works (7/14/30/60 days)
- [ ] Profile metrics display with league baselines
- [ ] Multiple teams can be compared side-by-side
- [ ] Data coverage panel shows game count and date range
- [ ] AuthGate blocks guests with signup prompt

### Models (`/analytics/models`) — Admin
- [ ] Training section: start training, cancel running jobs
- [ ] Training jobs poll for status updates
- [ ] Model registry: list models, activate toggle
- [ ] Performance: calibration report and degradation alerts
- [ ] AuthGate blocks non-admin users

### Batch Sims (`/analytics/batch`) — Admin
- [ ] Launch form: date picker, optional model ID, iterations
- [ ] Jobs list with expandable summary (avg win prob, total, duration)
- [ ] Jobs poll for status updates while running
- [ ] Record outcomes button works
- [ ] Prediction outcomes table shows correct/incorrect tracking
- [ ] AuthGate blocks non-admin users

### Golf (`/golf`)
- [ ] Tournament list loads with cards grouped by status (This Week, Upcoming, Recent Results)
- [ ] Tournament cards show name, course, dates, purse, status badge
- [ ] Clicking a tournament navigates to `/golf/[eventId]`
- [ ] Event page shows tournament details and leaderboard
- [ ] Leaderboard rows show position, player name, total score, today score, thru, round scores
- [ ] Leaderboard polls for updates (60s interval)

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

### Authentication
- [ ] Login with valid credentials succeeds and redirects to `/`
- [ ] Login with wrong credentials shows "Invalid email or password"
- [ ] Signup with new email succeeds and redirects to `/`
- [ ] Signup with existing email shows "An account with this email already exists"
- [ ] Signup validates: email format, password min 8 chars, confirm match
- [ ] Auth state persists across page refresh (token in localStorage)
- [ ] Expired token clears on next `/auth/me` call (auto-logout)
- [ ] 401 from any API route triggers auto-logout
- [ ] Guest sees "Log In" in top nav; authenticated user sees avatar initial
- [ ] Profile page: change email, change password, delete account all work
- [ ] Settings page: guests see "Sign in to sync" prompt; users see email + role + logout
- [ ] AuthGate on FairBet Live tab shows signup prompt for guests
- [ ] AuthGate on Analytics page shows signup prompt for guests
- [ ] "Forgot password?" link on login page navigates to `/forgot-password`
- [ ] Forgot password: submitting email shows confirmation message
- [ ] Reset password: page without `?token=` shows invalid link state
- [ ] Reset password: valid token + new password redirects to login on success
- [ ] Reset password: expired/invalid token shows error with link to request new one

### Preference Sync
- [ ] Login pulls server preferences (settings, pins, reveals overwrite local)
- [ ] Changing a setting while logged in pushes to server (check Network tab for PUT after ~2s)
- [ ] Signup pushes current local state as initial preferences
- [ ] Logout stops syncing; localStorage stays for guest browsing
- [ ] Following Live toggle persists across login/logout cycle
- [ ] Following Live auto-expires after 2 hours of inactivity

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
- Check backend is reachable (default: `https://sports-data-admin.dock108.ai`, override with `SPORTS_API_INTERNAL_URL`)
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

**Auth issues (401 / unexpected logout):**
- Check that `sd-auth` key in localStorage has a valid JWT token
- Expired tokens are cleared automatically on the next `/auth/me` call
- API routes forward the Authorization header via `forwardAuth()` — verify it's included in the route handler
- Auth proxy (`/api/auth/*`) does NOT send X-API-Key — this is intentional

**Realtime not connecting:**
- Check browser console for WebSocket connection errors
- Verify backend is running and `/v1/ws` endpoint is accessible
- Enable debug logging: set `REALTIME.DEBUG = true` in `lib/config.ts`
- Check the green/gray dot on the FairBet page for connection status

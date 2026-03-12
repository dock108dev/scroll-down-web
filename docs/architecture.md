# Architecture

System architecture and data flow for the Scroll Down Sports web app.

---

## Design Principle

The web app is a **thin display layer**. The backend computes all derived data — period labels, play tiers, odds outcomes, team colors, EV calculations, merged timelines. The client reads pre-computed values and renders them. No game logic, stat derivation, or EV math runs client-side.

## Data Flow

Two data paths exist: REST for initial loads and realtime for live updates.

### REST (Initial Load + Recovery)

```
Browser (React)
    ↓ fetch("/api/games")
Next.js API Route (server-side)
    ↓ apiFetch() with X-API-Key + optional Authorization header
Backend API (sports-data-admin.dock108.ai)
    ↓ JSON response
Next.js API Route
    ↓ NextResponse.json()
Browser → React hook → Component re-render
```

All backend calls go through Next.js API routes (`/api/*`), which add the `X-API-Key` header server-side. The API key is never exposed to the browser. When the user is authenticated, the client-side fetch wrapper includes a `Bearer` token, and the proxy routes forward it to the backend via `forwardAuth()`.

### Realtime (Live Updates)

```
Browser
    ↓ WebSocket connect to /v1/ws (primary)
    ↓ or EventSource to /v1/sse (fallback)
Backend realtime endpoint
    ↓ Event envelope { type, channel, seq, patch }
Dispatcher (single global handler)
    ↓ Seq check → Apply patch to Zustand store
Components re-render from store
```

See the [Realtime Layer](#realtime-layer) section for details.

### API Proxy Routes

| Client Route | Backend Endpoint | Purpose |
|---|---|---|
| `GET /api/games` | `/api/admin/sports/games` | Game list by date range |
| `GET /api/games/{id}` | `/api/admin/sports/games/{id}` | Game detail (stats, odds, plays, social) |
| `GET /api/games/{id}/flow` | `/api/admin/sports/games/{id}/flow` | Game flow narrative (blocks + moments) |
| `GET /api/fairbet/odds` | `/api/fairbet/odds` | FairBet odds with EV |
| `GET /api/fairbet/live` | `/api/fairbet/live` | Live odds for a game (closing + live + history) |
| `GET /api/fairbet/live/games` | `/api/fairbet/live/games` | Live games with odds available |
| `GET /api/analytics/mlb-teams` | `/api/analytics/mlb-teams` | MLB teams for simulation |
| `GET /api/analytics/mlb-roster` | `/api/analytics/mlb-roster?team=XXX` | Team roster (batters + pitchers) |
| `POST /api/analytics/simulate` | `/api/analytics/simulate` | Lineup-aware MLB simulation |
| `* /api/auth/*` | `/auth/*` | Authentication (login, signup, me, preferences, email, password, delete) |

Data routes use `revalidate: 0` (no ISR caching — always fresh from backend). Analytics routes (`mlb-teams`, `mlb-roster`) use `revalidate: 3600` (1-hour ISR cache) since team/roster data changes infrequently. FairBet and auth routes forward the `Authorization` header when present. Auth routes do not send `X-API-Key` — they are public endpoints on the backend.

## Authentication

JWT-based authentication with three roles:

| Role | Assignment | Access |
|---|---|---|
| `guest` | Default (no token) | Games, settings, pregame FairBet |
| `user` | Signed up / logged in | Everything guest + full FairBet, analytics |
| `admin` | Backend-assigned | Everything user + history |

### Flow

1. User signs up or logs in via `/login` page
2. Backend returns a JWT `access_token` and `role`
3. Token is stored in the `auth` Zustand store (persisted to localStorage)
4. `AuthProvider` validates the token on app mount via `GET /auth/me`; clears it on 401
5. After validation, `pullAndStartSync()` fetches server-side preferences and hydrates local stores (settings, pinned games, reveals). Local store changes are debounced and pushed back to the server while authenticated.
6. Client-side `fetchApi()` attaches `Authorization: Bearer <token>` to all requests
7. Proxy routes forward the header to the backend via `forwardAuth()`

### Feature Gating

`AuthGate` provides soft, non-blocking access control. When the user lacks the required role, it shows a signup prompt instead of the content. No hard walls — the app stays open and informational.

Currently gated:
- **FairBet Live tab** — requires `user` role
- **Analytics (MLB Simulator)** — requires `user` role
- **History** — API returns 403 for non-admin; page shows graceful message

### Preference Sync

User preferences (settings, pinned games, revealed game IDs) sync to the server for authenticated users via `lib/preferences-sync.ts`. Non-authed users retain localStorage-only behavior.

| Event | Behavior |
|---|---|
| Login / page reload with token | `GET /auth/me/preferences` → hydrate local stores from server (server is SSOT) |
| Local store change while authed | 2-second debounced `PUT /auth/me/preferences` pushes current state |
| Signup | Current localStorage pushed as initial preferences for the new account |
| Logout | Sync stops; localStorage stays for guest browsing |
| Tab close | `beforeunload` flushes any pending changes |
| Backend unavailable | All sync calls fail silently; app works normally |

Synced stores: `settings`, `pinned-games`, `reveal`. Reading positions are not synced (too transient). Pin metadata (team abbreviations) is not synced — derived from game data on render.

### Navigation

- **Forgot password:** Login page links to `/forgot-password` → user enters email → backend sends reset link → `/reset-password?token=...` → user sets new password
- **Guest:** "Log In" link in desktop nav, Account section in Settings shows login/signup links
- **Authenticated:** Email initial avatar in desktop nav linking to `/profile`, Account section in Settings shows email, role, manage/logout

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Game feed by date section (Yesterday, Today) with search, league filter, pinned games |
| `/game/[id]` | Game Detail | Full game view with flow, timeline, stats, odds, social |
| `/fairbet` | FairBet | Pre-Game tab (EV odds comparison + parlay) and Live tab (in-game odds movement, requires login) |
| `/analytics` | Analytics | Sport selection landing page — cards for each sport (MLB active, others coming soon) |
| `/analytics/mlb` | MLB Simulator | Lineup-aware Monte Carlo PA simulator powered by Statcast data (requires login) |
| `/history` | History | Browse past games by date range with search, sort, infinite scroll |
| `/login` | Login | Login and signup with tab switching, client-side validation |
| `/forgot-password` | Forgot Password | Email entry for password reset link |
| `/reset-password` | Reset Password | New password form with token from email link |
| `/profile` | Profile | Account management — change email, change password, delete account |
| `/settings` | Settings | Theme, score reveal mode, odds format, account section |

## Component Architecture

Pages are thin orchestrators. Hooks fetch data, stores provide persisted state, components render.

```
page.tsx (route)
    ├─ useGamesList() / useGameDetail() / useFairBetOdds()   # Data fetching
    ├─ useSettings() / useReveal() / useAuth()               # Zustand state
    └─ <TimelineSection> / <GameHeader> / <BetCard>          # Components
```

Components are organized by feature:

```
components/
├── auth/       # AuthProvider, AuthGate
├── home/       # GameRow, TimelineSection, SearchBar, PinnedBar
├── game/       # GameHeader, FlowContainer, TimelineSection, StatsSection,
│               # OddsSection, MiniScorebar, WrapUpSection, PregameBuzzSection, SocialSection, etc.
├── fairbet/    # BetCard, BookFilters, FairExplainerSheet, ParlaySheet, LiveOddsPanel
├── history/    # DateNavigator
├── settings/   # SettingsContent
├── layout/     # TopNav, BottomTabs, ThemeProvider, SettingsDrawer, RealtimeProvider
└── shared/     # LoadingSkeleton, CollapsibleCard, SectionHeader

features/
└── analytics/  # MLB PA Simulator (lineup-aware)
    ├── components/  # ProbabilityBar, ScoreCard, PABreakdown, LineupBuilder
    └── services/    # SimulatorService (teams, rosters, simulation)
```

## Realtime Layer

The realtime system provides live game updates via WebSocket (primary) or SSE (fallback). It replaces the previous polling-based approach.

### Transport (`realtime/transport.ts`)

Singleton `RealtimeTransport` manages connection state across three modes: `ws`, `sse`, and `offline`.

- **WebSocket primary:** Connects to `/v1/ws` (wss:// in production). 5-second connection timeout. Subscribes to channels via JSON messages.
- **SSE fallback:** After repeated WS failures (configurable threshold), falls back to `/v1/sse?channels=...`. Channels are embedded in the URL.
- **WS failure circuit breaker:** Tracks failures within a rolling window. After threshold, escalates to SSE. Exponential backoff between reconnection attempts.
- **SSE auto-healing:** After `SSE_FALLBACK_DURATION_MS` (5 min), attempts to switch back to WS.

### Dispatcher (`realtime/dispatcher.ts`)

Single global event handler registered on the transport. Routes events by type:

| Event Type | Channel Pattern | Action |
|---|---|---|
| `game_patch` | `games:*` or `game:*:summary` | `applyGamePatch()` to Zustand store |
| `pbp_append` | `game:*:pbp` | `appendPbp()` to Zustand store |
| `fairbet_patch` | `fairbet:odds` | Sets `needsFairbetRefresh` flag |

**Sequence handling:** Each channel tracks a sequence number. Events are checked before application:
- **Duplicate** (seq <= last): silently dropped
- **Gap** (seq > last + 1): channel marked as desynced, recovery triggered
- **OK** (seq = last + 1): applied normally, seq committed

**Recovery:** On gap detection, the dispatcher sets recovery flags in the store rather than retrying the event. Hooks watch these flags and trigger full REST refreshes. Recovery is throttled at 8 seconds per channel to prevent storms.

### Channels (`realtime/channels.ts`)

| Helper | Channel Format | Example |
|---|---|---|
| `gameListChannel(league, date)` | `games:{league}:{date}` | `games:nba:2026-03-05` |
| `gameSummaryChannel(gameId)` | `game:{id}:summary` | `game:12345:summary` |
| `gamePbpChannel(gameId)` | `game:{id}:pbp` | `game:12345:pbp` |
| `fairbetChannel()` | `fairbet:odds` | `fairbet:odds` |

### Hooks

- **`useRealtimeSubscription(channels[])`** — Declarative channel management. Subscribes on mount, diffs on change, unsubscribes on unmount. Initializes the dispatcher on first call.
- **`useRealtimeStatusSync()`** — Polls transport status into Zustand every 2 seconds. Mounted via `RealtimeProvider` in root layout.

### Recovery Flag Pattern

The dispatcher sets flags in the `game-data` store. Hooks watch these flags via `useEffect` and trigger REST refreshes:

| Flag | Set By | Consumed By |
|---|---|---|
| `needsListRefresh` | List channel gap | `useGamesList` |
| `needsGameRefresh` | Summary channel gap | `useGameDetail` |
| `needsPbpRefresh` | PBP channel gap | Game detail page |
| `needsFairbetRefresh` | FairBet channel event | `useFairBetOdds` |

## Data Fetching Hooks

### useGamesList

Fetches the home feed, organized by date sections (Yesterday, Today).

- **Freshness:** 45-second window — skips network if cache is younger
- **Cache TTL:** 90 seconds before expiry
- **Updates:** Realtime patches via `gameListChannel`. Visibility-driven refresh when tab regains focus after >5 seconds hidden (browsers throttle background tabs, so realtime events may be missed even while connected).
- **Client-side search:** Filters by team name/abbreviation without API round-trip
- **Timezone:** Uses US/Eastern for section boundaries via `lib/date-utils.ts`

### useGameDetail

Fetches a single game detail with realtime patches.

- **Cache:** 5-minute freshness TTL in `game-data` store
- **Updates:** Realtime patches via `gameSummaryChannel`. Visibility-driven refresh when tab regains focus after >5 seconds hidden.
- **Score freeze:** Accepts reveal snapshot updates on unmount for live games

### useGameFlow

Fetches game flow data (narrative blocks and moments).

- **Cache:** 5-minute freshness TTL. Shows cached data immediately while refreshing in the background if stale.
- **No realtime:** Flow data is static (generated post-game).

### useFairBetOdds

FairBet pre-game odds with pagination, filtering, sorting, and parlay management.

- **Cache:** In-memory with 3-minute TTL, 90-second freshness window
- **Pagination:** 100 bets/page, first page renders immediately, remaining pages load with up to 3 concurrent fetches
- **Filtering:** League, market category, book, search, +EV only, hide thin confidence, hide started. Minimum 3 books per bet.
- **Sorting:** By best EV% (descending), game time, or league
- **Parlay:** Client-side `parlayProbIndependent()` computes combined fair odds (assumes independent legs)
- **Updates:** Realtime via `fairbetChannel()`. Visibility-driven refresh when tab regains focus after >5 seconds hidden.

### useFairBetLive

Discovers all live games and fetches odds for each in parallel.

- **Discovery:** `GET /api/fairbet/live/games` returns all games with live odds available, optionally filtered by league.
- **Parallel fetch:** Odds for all discovered games fetched via `Promise.allSettled()` — individual game failures don't block others.
- **Polling:** 15-second full refresh (discover + fetch all) via `POLLING.LIVE_ODDS_REFRESH_MS`.
- **Client-side filtering:** League, market category, +EV only, hide thin confidence, hide alternates, search text — all applied client-side for instant feedback.
- **Parlay:** Client-side bet selection and parlay building across all live games.

### useHistoricalGames

Paginated historical game browsing for the history page.

- **Pagination:** 25 games per page, infinite scroll with `loadMore()`
- **Search:** 300ms debounce on team name search
- **Filters:** League, date range, sort mode (away/home alphabetical, time)
- **State:** Filters stored in URL search parameters

### useScoreDisplay

Computes visible score state by combining core data, reveal state, and settings. Returns visibility, frozen state, and update status.

## State Management

Six Zustand stores persist to localStorage. Three more are in-memory only.

| Store | Key | Purpose |
|---|---|---|
| `auth` | `sd-auth` | JWT token, role, email, userId for authentication |
| `settings` | `sd-settings` | Theme, odds format, score reveal mode, preferred book, section expansion, following-live state |
| `reveal` | `sd-read-state` | Score reveal state with frozen snapshots for live games |
| `reading-position` | `sd-reading-position` | Per-game scroll position and score snapshot |
| `section-layout` | `sd-section-layout` | Game detail section collapse/expand state |
| `pinned-games` | `sd-pinned-games` | User-pinned games for quick access (max 10) |
| `game-data` | — | Normalized game data cache + realtime state. Not persisted. |
| `home-scroll` | — | Home page scroll position for restoration. Not persisted. |
| `ui` | — | Transient UI state (settings drawer open/close). Not persisted. |

Storage keys are centralized in `lib/config.ts` under `STORAGE_KEYS`.

### Storage Bounds

All persisted stores enforce size limits to prevent unbounded localStorage growth:

| Store | Limit |
|---|---|
| Reveal snapshots | 20 entries (newest kept) |
| Revealed IDs | 500 entries (newest kept) |
| Reading positions | 50 entries, 30-day max age |
| Section layouts | 50 entries (newest kept) |
| Pinned games | 10 max |

### Settings Store Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `theme` | `"system" \| "light" \| "dark"` | `"system"` | Color theme preference |
| `scoreRevealMode` | `"always" \| "onMarkRead"` | `"onMarkRead"` | Score visibility behavior |
| `oddsFormat` | `"american" \| "decimal" \| "fractional"` | `"american"` | Odds display format |
| `preferredSportsbook` | `string` | `""` | Preferred book highlight |
| `autoResumePosition` | `boolean` | `true` | Resume scroll on game return |
| `homeExpandedSections` | `string[]` | `[]` | Expanded home sections |
| `hideLimitedData` | `boolean` | `true` | Hide thin-market odds |
| `timelineDefaultTiers` | `number[]` | `[1, 2, 3]` | Default play tier visibility |
| `followingLive` | `boolean` | `false` | Live score following mode (auto-expires after 2hr inactivity) |
| `followingLiveAt` | `number` | `0` | Timestamp of last activity while following live |

## Game Status Lifecycle

```
scheduled → pregame → in_progress / live → completed / final → archived
```

Helper functions: `isLive()`, `isFinal()`, `isPregame()` (in `lib/types.ts`).

Content changes based on status:
- **Pregame:** Pregame Buzz + Odds sections
- **Live:** Timeline + Stats + Odds, with realtime patches
- **Final:** Flow + Timeline + Stats + Odds + Wrap-Up

The MLB Matchup Simulator is available at `/analytics/mlb` (accessed from the `/analytics` sport selection landing page) — not embedded in the game detail page.

## Flow Rendering

Game flow is a server-generated narrative structure. Each `FlowBlock` contains:

| Field | Description |
|---|---|
| `blockIndex` | Position in the flow (0 to N-1) |
| `role` | Semantic role (setup, momentum_shift, response, decision_point, resolution) — not displayed |
| `narrative` | 1-2 sentence description (~35 words) |
| `miniBox` | Player stats for this segment with `blockStars` array |
| `periodStart` / `periodEnd` | Period range covered |
| `scoreBefore` / `scoreAfter` | Score progression as `[away, home]` |
| `keyPlayIds` | Plays explicitly mentioned in narrative |
| `embeddedSocialPostId` | Optional linked social post |

`FlowContainer` resolves blocks from either `data.flow.blocks` (nested) or `data.blocks` (top-level) to handle both API response shapes.

## Score Reveal

Two modes controlled by `scoreRevealMode`:

| Mode | Behavior |
|---|---|
| `onMarkRead` | Scores hidden until user taps to reveal (default, spoiler-free) |
| `always` | Scores always visible on rows and headers |

Additional behaviors:
- **Score freeze:** Revealed live game scores freeze at the moment of reveal. An amber dot appears when new data arrives.
- **Auto-hide on final:** When a live game transitions to final while scores are frozen, the game auto-hides to prevent spoiling the final score.
- **Mark All Read:** Bulk action to reveal all eligible games.
- **Following Live:** Toggle in the top nav (when `scoreRevealMode` is `onMarkRead`) temporarily treats all scores as `always` visible. Persisted in settings store and synced to server. Auto-expires after 2 hours of inactivity — activity (pointer, keyboard, scroll, visibility) resets the timer. Stored as `followingLive` + `followingLiveAt` timestamp; expiry checked both at runtime (60-second interval) and on store rehydration.

## FairBet Architecture

**Server-side EV (all computation on backend):**
- True probability via Pinnacle devig
- Per-bet: `evConfidenceTier`, `fairAmericanOdds`, `bestEvPercent`, `bestBook`
- Per-book: `evPercent`, `isSharp`, `impliedProb`
- Method transparency: `evMethodDisplayName`, `evMethodExplanation`, `explanationSteps`

**Client-side responsibilities:**
- Display formatting: EV color mapping, confidence labels, odds format conversion
- Filtering and sorting
- Parlay selection state and client-side evaluation
- Bet enrichment: adding camelCase aliases to snake_case API fields (`enrichBet()`)

**Live tab:** Discovers all games with live odds, fetches closing lines, current live odds, and movement history for each in parallel. Supports league filter, market category, +EV only, hide thin/alternates, and search. 15-second full-refresh cycle. Requires `user` role — guests see a signup prompt.

## Theming

CSS-variable-based light/dark mode:
- `:root` holds light mode palette (inverted neutrals)
- `.dark` class holds dark mode palette (standard neutrals)
- `ThemeProvider` toggles the `dark` class on `<html>` based on settings store
- FairBet uses dedicated CSS variables (`--fb-card-bg`, `--fb-surface-tint`, `--fb-border-subtle`, etc.)
- Tailwind CSS 4 uses `@theme` (not `@theme inline`) so utility classes reference CSS variables

## Supported Leagues

NBA, NCAAB, NFL, NCAAF, MLB, NHL.

## MLB PA Simulator

The `/analytics` page is a sport selection landing page with cards for each sport. MLB is active and links to `/analytics/mlb`; other sports show "Coming Soon". The MLB simulator is a lineup-aware plate appearance simulator powered by the backend's Monte Carlo engine and real Statcast data. Requires `user` role.

### Flow

1. User selects home and away teams from dropdowns (populated via `GET /api/analytics/mlb-teams`)
2. Rosters auto-load for each selected team via `GET /api/analytics/mlb-roster?team=XXX`
3. LineupBuilder components auto-fill the top 9 batters (by games played) and top starting pitcher for each team
4. User can customize batting order, swap players, and select a different starter
5. Starter innings slider sets when the bullpen takes over (default 6.0, range 4.0–9.0)
6. "Run Simulation" calls `POST /api/analytics/simulate` with full lineup data
7. Results display: lineup mode confirmation badge, win probabilities, expected scores, top 5 most likely final scores, and PA probability profiles

Both lineups must have exactly 9 batters and a starting pitcher selected before simulation can run.

### API Integration

| Client Route | Backend Endpoint | Method | Purpose |
|---|---|---|---|
| `/api/analytics/mlb-teams` | `/api/analytics/mlb-teams` | GET | List MLB teams |
| `/api/analytics/mlb-roster` | `/api/analytics/mlb-roster?team=XXX` | GET | Team roster (batters + pitchers) |
| `/api/analytics/simulate` | `/api/analytics/simulate` | POST | Run lineup-aware Monte Carlo simulation (10,000 iterations, ML mode) |

### Caching

Team list and rosters are cached in-memory after first fetch. Simulation results are not cached (lineup permutations make cache keys impractical). All caches clear on page reload.

## Known Limitations

- **No service worker** — Cache is in-memory only, cleared on page reload.
- **No offline support** — Requires network connectivity.
- **Parlay assumes independent legs** — Client-side `parlayProbIndependent()` multiplies leg probabilities; no correlation modeling.
- **FairBet client-side fallback removed** — All EV computation is server-side. If the server doesn't provide EV data for a bet, it's displayed without EV.
- **Live odds polling** — `useFairBetLive` discovers all live games and fetches their odds in parallel on a 15s polling interval rather than realtime. The `fairbet:odds` realtime channel covers pre-game odds only.
- **Forgot-password depends on backend** — The web app has `/forgot-password` and `/reset-password` pages that call `POST /auth/forgot-password` and `POST /auth/reset-password`. These backend endpoints must be implemented to send reset emails and validate tokens.

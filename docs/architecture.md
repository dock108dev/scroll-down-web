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
    ↓ apiFetch() with X-API-Key header
Backend API (sports-data-admin.dock108.ai)
    ↓ JSON response
Next.js API Route
    ↓ NextResponse.json()
Browser → React hook → Component re-render
```

All backend calls go through Next.js API routes (`/api/*`), which add the `X-API-Key` header server-side. The API key is never exposed to the browser.

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
| `POST /api/analytics/simulate` | `/api/analytics/simulate` | Monte Carlo game simulation |
| `GET /api/analytics/mlb/pitch-model` | `/api/analytics/mlb/pitch-model` | MLB pitch outcome probabilities |
| `GET /api/analytics/mlb/run-expectancy` | `/api/analytics/mlb/run-expectancy` | MLB run expectancy for base/out state |

All routes use `revalidate: 0` (no ISR caching — always fresh from backend).

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Game feed by date section (Yesterday, Today) with search, league filter, pinned games |
| `/game/[id]` | Game Detail | Full game view with flow, timeline, stats, odds, social |
| `/fairbet` | FairBet | Pre-Game tab (EV odds comparison + parlay) and Live tab (in-game odds movement) |
| `/history` | History | Browse past games by date range with search, sort, infinite scroll |
| `/settings` | Settings | Theme, score reveal mode, odds format preferences |

## Component Architecture

Pages are thin orchestrators. Hooks fetch data, stores provide persisted state, components render.

```
page.tsx (route)
    ├─ useGamesList() / useGameDetail() / useFairBetOdds()   # Data fetching
    ├─ useSettings() / useReveal()                           # Zustand state
    └─ <TimelineSection> / <GameHeader> / <BetCard>          # Components
```

Components are organized by feature:

```
components/
├── home/       # GameRow, TimelineSection, SearchBar, PinnedBar
├── game/       # GameHeader, FlowContainer, TimelineSection, StatsSection,
│               # OddsSection, MiniScorebar, WrapUpSection, PregameBuzzSection, SocialSection, etc.
├── fairbet/    # BetCard, BookFilters, FairExplainerSheet, ParlaySheet, LiveOddsPanel
├── history/    # DateNavigator
├── settings/   # SettingsContent
├── layout/     # TopNav, BottomTabs, ThemeProvider, SettingsDrawer, RealtimeProvider
└── shared/     # LoadingSkeleton, CollapsibleCard, SectionHeader

features/
└── analytics/  # Self-contained analytics module
    ├── apps/   # SimulationApp, LivePredictionApp (with pitch animation engine)
    ├── components/  # ProbabilityBar, UniverseCard, AnalyticsAppCard
    └── services/    # SimulationService, PredictionService
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
- **Duplicate** (seq ≤ last): silently dropped
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
- **Updates:** Realtime patches via `gameListChannel`. Visibility-driven refresh when tab regains focus while offline.
- **Client-side search:** Filters by team name/abbreviation without API round-trip
- **Timezone:** Uses US/Eastern for section boundaries

### useGameDetail

Fetches a single game detail with realtime patches.

- **Cache:** 5-minute freshness TTL in `game-data` store
- **Updates:** Realtime patches via `gameSummaryChannel`. Visibility-driven refresh when tab regains focus while offline.
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
- **Updates:** Realtime via `fairbetChannel()`. Visibility-driven refresh when offline.

### useFairBetLive

Fetches live odds for a single game — closing lines, current live snapshot, and movement history.

- **Per-game:** Requires `game_id`. Optional `market_key` filter.
- **Polling:** 15-second interval while a game is selected
- **No cache:** Always fetches fresh data

### useHistoricalGames

Paginated historical game browsing for the history page.

- **Pagination:** 25 games per page, infinite scroll with `loadMore()`
- **Search:** 300ms debounce on team name search
- **Filters:** League, date range, sort mode (away/home alphabetical, time)
- **State:** Filters stored in URL search parameters

### useScoreDisplay

Computes visible score state by combining core data, reveal state, and settings. Returns visibility, frozen state, and update status.

## State Management

Five Zustand stores persist to localStorage. Three more are in-memory only.

| Store | Key | Purpose |
|---|---|---|
| `settings` | `sd-settings` | Theme, odds format, score reveal mode, preferred book, section expansion |
| `reveal` | `sd-read-state` | Score reveal state with frozen snapshots for live games |
| `reading-position` | `sd-reading-position` | Per-game scroll position and score snapshot |
| `section-layout` | `sd-section-layout` | Game detail section collapse/expand state |
| `pinned-games` | `sd-pinned-games` | User-pinned games for quick access (max 10) |
| `game-data` | — | Normalized game data cache + realtime state. Not persisted. |
| `home-scroll` | — | Home page scroll position for restoration. Not persisted. |
| `ui` | — | Transient UI state (settings drawer, live-following mode). Not persisted. |

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

## Game Status Lifecycle

```
scheduled → pregame → in_progress / live → completed / final → archived
```

Helper functions: `isLive()`, `isFinal()`, `isPregame()` (in `lib/types.ts`).

Content changes based on status:
- **Pregame:** Pregame Buzz + Analytics + Odds sections
- **Live:** Timeline + Analytics + Stats + Odds, with realtime patches
- **Final:** Flow + Analytics + Timeline + Stats + Odds + Wrap-Up

The Analytics section appears for supported leagues (MLB, NBA, NHL, NCAAB) and provides access to multiple analytics apps (see [Analytics](#analytics) section below).

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

**Live tab:** Displays closing lines (captured at game start), current live odds from Redis, and movement history for a selected game. Per-game, per-market view with 15-second auto-refresh.

## Theming

CSS-variable-based light/dark mode:
- `:root` holds light mode palette (inverted neutrals)
- `.dark` class holds dark mode palette (standard neutrals)
- `ThemeProvider` toggles the `dark` class on `<html>` based on settings store
- FairBet uses dedicated CSS variables (`--fb-card-bg`, `--fb-surface-tint`, `--fb-border-subtle`, etc.)
- Tailwind CSS 4 uses `@theme` (not `@theme inline`) so utility classes reference CSS variables

## Supported Leagues

NBA, NCAAB, NFL, NCAAF, MLB, NHL.

## Analytics

The Analytics section is a modular analytics platform embedded in the game detail page. It appears as a collapsible section for MLB, NBA, NHL, and NCAAB games across all game statuses (pregame, live, final).

### Architecture

```
AnalyticsTab (hub)
├── AnalyticsAppGrid        # Card grid showing available tools
├── SimulationApp            # Alternate Game Universes
└── LivePredictionApp        # What Happens Next (MLB live only)
    └── MatchupAnimation     # SVG pitch animation engine
```

The `AnalyticsTab` manages routing between the app grid and the active app. Each app is self-contained with its own API calls, caching, and UI.

### Available Apps

| App | ID | Leagues | Requires Live | Description |
|-----|----|---------|---------------|-------------|
| Alternate Game Universes | `simulation` | MLB, NBA, NHL, NCAAB | No | Monte Carlo simulation — win probabilities, average scores, top score outcomes |
| What Happens Next | `live-prediction` | MLB | Yes | Pitch outcome probabilities + run expectancy with animated SVG matchup visualization |
| Matchup Explorer | `matchup` | — | — | Placeholder (not yet implemented) |
| Player Projections | `player-projections` | — | — | Placeholder (not yet implemented) |

### API Integration

| Client Route | Backend Endpoint | Method | Purpose |
|---|---|---|---|
| `/api/analytics/simulate` | `/api/analytics/simulate` | POST | Monte Carlo game simulation (5000 iterations, ensemble mode) |
| `/api/analytics/mlb/pitch-model` | `/api/analytics/mlb/pitch-model` | GET | Pitch outcome probabilities (ball, strike, foul, in play) |
| `/api/analytics/mlb/run-expectancy` | `/api/analytics/mlb/run-expectancy` | GET | Expected runs for base/out state |

### Caching

- **Simulation results:** Cached per game ID in a module-level `Map`. Runs once per session — survives re-renders but clears on page reload.
- **Pitch predictions:** 10-second TTL cache. Auto-polls every 5 seconds during live games.
- **Run expectancy:** 10-second TTL cache. Fetched alongside pitch predictions.

### Pitch Animation Engine

The `LivePredictionApp` includes an SVG-based pitch matchup animation (`MatchupAnimation`) that visually simulates pitcher-batter interactions using API-driven probabilities.

- Pure SVG + `requestAnimationFrame` — no external animation libraries
- ~1.8 second animation timeline: windup → release → ball travel (quadratic bezier) → swing → outcome
- Outcome sampled from probability distribution (`sampleOutcome()`)
- Five outcome animations: ball (no swing), called strike (no swing), swinging strike, foul (pop-up trajectory), in play (field trajectory)
- Overlay shows outcome label and probability percentage

## Known Limitations

- **No authentication** — No user accounts. All state is local to the browser via localStorage.
- **No service worker** — Cache is in-memory only, cleared on page reload.
- **No offline support** — Requires network connectivity.
- **Parlay assumes independent legs** — Client-side `parlayProbIndependent()` multiplies leg probabilities; no correlation modeling.
- **FairBet client-side fallback removed** — All EV computation is server-side. If the server doesn't provide EV data for a bet, it's displayed without EV.
- **Live odds polling** — `useFairBetLive` uses 15s polling rather than realtime. The `fairbet:odds` realtime channel covers pre-game odds only.

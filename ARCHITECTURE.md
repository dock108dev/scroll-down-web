# Architecture

## Overview

Scroll Down is a **read-only frontend** — it displays sports data but does not scrape, ingest, or store it. All data comes from a single backend API (`sda.dock108.dev`). The frontend handles caching, realtime updates, score reveal state, and user preferences locally.

```
Browser ──► Next.js App (port 3001) ──► Backend API (sda.dock108.dev)
              │                            │
              ├─ API proxy routes           ├─ Game scores & stats
              ├─ WebSocket / SSE            ├─ FairBet odds & EV
              ├─ Zustand stores             ├─ Golf tournaments
              └─ localStorage               ├─ Auth (JWT)
                                            └─ Preference sync
```

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript 6 · Zustand 5 · Tailwind CSS 4 · Playwright

## Key Components

### 1. API Proxy Layer

All backend calls route through Next.js API routes (`src/app/api/`). The proxy injects `X-API-Key` server-side so credentials never reach the browser.

**Game & FairBet Routes**

| Route | Backend | Purpose |
|-------|---------|---------|
| `GET /api/games` | `/api/admin/sports/games` | Game list by date range |
| `GET /api/games/[id]` | `/api/admin/sports/games/:id` | Game detail (stats, odds, PBP) |
| `GET /api/games/[id]/flow` | `/api/admin/sports/games/:id/flow` | Narrative flow blocks |
| `GET /api/fairbet/odds` | `/api/fairbet/odds` | Pre-game EV analysis |
| `GET /api/fairbet/live/games` | `/api/fairbet/live/games` | Live game discovery |
| `GET /api/fairbet/live` | `/api/fairbet/live` | Live in-game odds |
| `GET /api/realtime/sse` | `/v1/sse` | SSE proxy (EventSource can't set headers) |
| `* /api/auth/[...path]` | `/auth/*` | Auth proxy with path whitelist + rate limiting |

**Golf Routes**

| Route | Backend | Purpose |
|-------|---------|---------|
| `GET /api/golf/tournaments` | `/api/golf/tournaments` | Tournament list |
| `GET /api/golf/tournaments/[eventId]` | `/api/golf/tournaments/:eventId` | Tournament detail |
| `GET /api/golf/tournaments/[eventId]/leaderboard` | `/api/golf/tournaments/:eventId/leaderboard` | Leaderboard |

**Analytics Routes** (admin-gated)

| Route | Backend | Method | Purpose |
|-------|---------|--------|---------|
| `/api/analytics/mlb-teams` | `/api/analytics/mlb-teams` | GET | MLB team list (1hr ISR cache) |
| `/api/analytics/mlb-roster` | `/api/analytics/mlb-roster?team=XXX` | GET | Team roster (1hr ISR cache) |
| `/api/analytics/simulate` | `/api/analytics/simulate` | POST | Run lineup-aware simulation |
| `/api/analytics/team-profile` | `/api/analytics/team-profile` | GET | Team performance profile (1hr ISR cache) |
| `/api/analytics/mlb-data-coverage` | `/api/analytics/mlb-data-coverage` | GET | Data coverage stats (1hr ISR cache) |
| `/api/analytics/train` | `/api/analytics/train` | POST | Start model training |
| `/api/analytics/training-jobs` | `/api/analytics/training-jobs` | GET | Training job list |
| `/api/analytics/models-list` | `/api/analytics/models` | GET | Registered models |
| `/api/analytics/models-activate` | `/api/analytics/models/activate` | POST | Activate a model |
| `/api/analytics/calibration-report` | `/api/analytics/calibration-report` | GET | Model calibration (1hr ISR cache) |
| `/api/analytics/degradation-alerts` | `/api/analytics/degradation-alerts` | GET | Model degradation alerts |
| `/api/analytics/batch-simulate` | `/api/analytics/batch-simulate` | POST | Start batch simulation |
| `/api/analytics/batch-simulate-jobs` | `/api/analytics/batch-simulate-jobs` | GET | Batch job list |
| `/api/analytics/batch-simulate-job/[id]` | `/api/analytics/batch-simulate-jobs/:id` | GET/POST | Job detail & operations |
| `/api/analytics/record-outcomes` | `/api/analytics/record-outcomes` | POST | Record prediction outcomes |
| `/api/analytics/prediction-outcomes` | `/api/analytics/prediction-outcomes` | GET | Prediction outcome history |

**Simulator Routes**

| Route | Backend | Method | Purpose |
|-------|---------|--------|---------|
| `/api/simulator/[sport]/teams` | `/api/simulator/:sport/teams` | GET | Team list — sport whitelist: `mlb`, `nba`, `nhl`, `ncaab` (1hr ISR cache) |
| `/api/simulator/[sport]` | `/api/simulator/:sport` | POST | Run Monte Carlo simulation for any supported sport |

**Tracking & Health**

| Route | Purpose |
|-------|---------|
| `POST /api/analytics-event` | Self-hosted analytics. Logs structured JSON to stdout (Docker captures). IPs anonymized. |
| `GET /api/health` | Returns `{ status, timestamp }`. Returns `"degraded"` if backend unreachable. |

Server-side config: `src/lib/api-server.ts`. Client fetch wrapper: `src/lib/api.ts`.

### 2. Realtime Transport

Three-tier transport with automatic failover:

```
WebSocket (primary) ──► SSE (fallback) ──► Polling (degraded)
    wss://sda.dock108.dev/v1/ws    /api/realtime/sse
```

- **WebSocket**: Primary transport. Connects to backend directly.
- **SSE**: Fallback when WS fails 2x in 60s. Proxied through API route (EventSource can't set headers).
- **Polling**: Degraded mode when both are down. Uses existing fetch hooks with shorter intervals.

**Recovery**: Exponential backoff (1s → 30s). After 5 minutes on SSE, retries WebSocket. Recovery requests throttled to 8s minimum per channel.

**Event types**:

| Event | Channel Pattern | Effect |
|-------|----------------|--------|
| `game_patch` | `game:<id>:summary` or `games:<league>:<date>` | Patches score, status, clock in store |
| `pbp_append` | `game:<id>:pbp` | Appends new plays (deduped by eventId) |
| `fairbet_patch` | `fairbet:*` | Triggers full FairBet re-fetch |

**Sequence tracking**: Each channel maintains a sequence number. Gaps trigger full recovery re-fetch for that channel.

Implementation: `src/realtime/` (transport.ts, dispatcher.ts, channels.ts, hooks).

### 3. Zustand Stores

| Store | Key | Persisted | Purpose | Limits |
|-------|-----|-----------|---------|--------|
| `game-data` | — | No | Normalized game cache + realtime sequence state | 8 detail, 8 flow entries |
| `game-core` | — | No | Core game data structure (supporting store) | — |
| `auth` | `sd-auth` | Yes | JWT token, role, email, userId | — |
| `settings` | `sd-settings` | Yes | Theme, reveal mode, odds format, sportsbook, etc. | 20 leagues, 100 teams |
| `reveal` | `sd-read-state` | Yes | Revealed game IDs + score snapshots | 500 IDs, 20 snapshots |
| `pinned-games` | `sd-pinned-games` | Yes | Pinned game IDs + team abbreviations | 10 games |
| `reading-position` | `sd-reading-position` | Yes | Per-game play index for timeline resume | 50 positions, 30-day age |
| `section-layout` | `sd-section-layout` | Yes | Per-game section expand/collapse state | 50 layouts |
| `home-scroll` | — | No | Home page scroll Y position | — |
| `ui` | — | No | Ephemeral UI state (settings drawer) | — |

### 4. Data Fetching Hooks

| Hook | Purpose | Cache TTL |
|------|---------|-----------|
| `useGamesList` | Games by date (Yesterday/Today/Upcoming) | 90s |
| `useGameDetail` | Single game with stats, odds, social | 5m |
| `useGameFlow` | Narrative flow blocks | 5m |
| `useFairBetOdds` | Betting odds across books | 3m |
| `useFairBetLive` | Live in-game odds (polls every 15s) | 3m |
| `useFollowingLive` | Auto-refresh in Following Live mode | 45s poll |
| `useGolfTournaments` | Golf tournament list | 5m |
| `useGolfLeaderboard` | Golf leaderboard | 60s poll |
| `useScoreDisplay` | Compute score visibility from settings | Derived |
| `useAutoRetry` | Exponential backoff on error | — |
| `useVisibilityRefresh` | Re-fetch when tab returns after 5+ seconds | — |
| `useHealthStatus` | Backend health check | — |
| `useFreshnessLabel` | Compute freshness label from timestamp | Derived |
| `useHistoricalGames` | Historical game pagination | — |

### 5. Score Reveal System

The product's core differentiator. Two modes controlled by `scoreRevealMode` setting:

- **`onMarkRead`** (default): Scores hidden until user explicitly clicks Reveal
- **`always`**: Scores always visible (traditional scoreboard behavior)

**Following Live** mode overrides to `always` for continuous live updates.

**Blacklist**: Users can hide scores by league or team (`scoreHideLeagues`, `scoreHideTeams`).

**Snapshots**: When a user reveals a game, the current score/period/clock is captured. If the live score later differs from the snapshot, an UPDATE indicator appears — "new data since you last looked."

Implementation: `src/stores/reveal.ts`, `src/lib/score-display.ts`, `src/lib/score-hide.ts`, `src/hooks/useScoreDisplay.ts`.

### 6. Auth Model

- JWT Bearer tokens stored in Zustand (`sd-auth` localStorage key)
- Roles: `guest` (unauthenticated), `user`, `admin`
- Token validated on app load via `GET /api/auth/me`; invalid → auto-logout
- Preference sync starts after successful login, stops on logout

**Auth Proxy Security**

Path whitelist — only these backend paths are forwarded; all others return 404:

```
login, signup, me, me/email, me/password, me/preferences,
refresh, forgot-password, reset-password, magic-link, magic-link/verify
```

Rate limiting (in-memory sliding-window per IP):

| Tier | Limit | Paths |
|------|-------|-------|
| Strict | 8 req/min | `login`, `signup`, `forgot-password`, `reset-password`, `magic-link`, `magic-link/verify` |
| Standard | 30 req/min | `me`, `me/email`, `me/password`, `me/preferences`, `refresh` |

Returns `429 Too Many Requests` with `Retry-After` header when exceeded. Implementation: `src/lib/rate-limit.ts`.

### 7. Preference Sync

For authenticated users, settings sync bidirectionally with the backend:

- **On login**: Pull server preferences → hydrate local stores
- **On change**: Debounced push (2s delay) to server
- **On logout**: Sync stops; localStorage retained for guest browsing
- **Conflict**: Server is authoritative for pinned IDs and revealed IDs

What syncs: settings, pinned game IDs, revealed game IDs.
What doesn't: snapshots, reading positions, section layouts, scroll position.

### 8. Analytics Feature (Admin/Power-User)

The analytics section lives under a `(mlb)` Next.js route group sharing a tab navigation bar.

| Tab | Route | Min Role |
|-----|-------|----------|
| Simulator | `/analytics/simulator` | user |
| Profiles | `/analytics/profiles` | user |
| Models | `/analytics/models` | admin |
| Batch Sims | `/analytics/batch` | admin |

Multi-sport simulators (NBA, NHL, NCAAB) are available at `/analytics/nba`, `/analytics/nhl`, `/analytics/ncaab` using the public simulator API (`/api/simulator/{sport}`).

Service layer: `src/features/analytics/services/` — one service file per page following the pattern in `SimulatorService.ts`.

## Data Flow

### Initial Load (Home Page)

1. `useGamesList` fetches games for yesterday + today (Eastern timezone)
2. Response cached in `game-data` store (normalized by game ID)
3. Realtime subscription to `games:<league>:<date>` channels for live patches
4. Visibility refresh: re-fetches when tab returns after 5+ seconds away
5. Sorting: live games first → upcoming → finals

### Live Realtime Patch

1. WebSocket receives `game_patch` event on subscribed channel
2. Dispatcher checks sequence number (drop duplicate, recover on gap)
3. Patch applied to `game-data` store — score, status, clock updated in-place
4. React re-renders via Zustand selector (no full re-fetch)

### Score Reveal Interaction

1. User clicks Reveal on a game row
2. `reveal` store adds game ID to `revealedIds` Set
3. Snapshot captured: current score + period + clock → `snapshots` Map
4. `useScoreDisplay` recalculates: score now visible for this game
5. If live score later changes from snapshot → UPDATE indicator shown

### FairBet

1. `useFairBetOdds` fetches all pages of odds (100/page, max 3 concurrent)
2. Client-side enrichment: display labels, title-casing, fair odds fallbacks
3. 3-minute cache, 90-second fresh threshold (silent background refresh)
4. Live odds (auth-gated) poll every 15 seconds for in-progress games

### Golf

1. `useGolfTournaments` fetches tournament list, groups by status (This Week / Upcoming / Recent)
2. `useGolfLeaderboard` fetches leaderboard for a tournament with 60-second polling
3. Tournament data refreshed every 5 minutes

## Directory Structure

```
web/src/
├── app/                    # Next.js App Router
│   ├── api/                # API proxy routes (games, fairbet, golf, auth, analytics, simulator)
│   ├── game/[id]/          # Game detail page + OG image generation
│   ├── fairbet/            # Betting odds discovery
│   ├── golf/               # Golf tournaments & leaderboard
│   ├── analytics/          # ML analytics (admin/power-user)
│   ├── auth/               # Login, signup, magic-link, password reset
│   ├── history/            # Historical games viewer
│   ├── profile/            # User account
│   ├── settings/           # User preferences
│   └── (legal)             # /privacy, /terms, /contact
│
├── components/
│   ├── auth/               # AuthProvider, AuthGate
│   ├── layout/             # TopNav, BottomTabs, Footer, SettingsDrawer, RealtimeProvider, ThemeProvider
│   ├── game/               # GameHeader, Timeline, Stats, Odds, Flow, WrapUp, Social (21 components)
│   ├── home/               # GameRow, PinnedBar, SearchBar, TimelineSection
│   ├── fairbet/            # BetCard, BookFilters, LiveOddsPanel, ParlaySheet, ExplainerSheet
│   ├── golf/               # Leaderboard, TournamentCard, LeaderboardRow
│   ├── settings/           # SettingsContent, ScoreHideBlacklistControls
│   └── shared/             # Spinner, LoadingSkeleton, SectionHeader, CollapsibleSection, StaleBanner
│
├── features/
│   └── analytics/          # MLB analytics feature
│       ├── components/     # AnalyticsTabNav, ProbabilityBar, ScoreCard, LineupBuilder, SimulatorResults
│       └── services/       # SimulatorService, PublicSimulatorService, ModelsService, BatchService
│
├── hooks/                  # Data fetching & realtime hooks (14 hooks)
├── stores/                 # Zustand state management (10 stores)
├── realtime/               # WebSocket/SSE transport, dispatcher, channel naming, hooks
└── lib/                    # Utilities (api, types, config, date, score-hide, fairbet-utils, etc.)
```

## Degraded-State Handling

When the backend is unavailable:

1. **Cache fallback**: Game data, FairBet odds, and golf tournaments are cached to localStorage (`sd-games-cache`, `sd-fairbet-cache`, `sd-golf-cache`). On failure, cached data is shown silently.
2. **Stale indicator**: Admin users see "Showing cached data" banner (controlled by `showStaleBanners` setting). Regular users see nothing.
3. **Auto-retry**: 3 retries with exponential backoff (3s, 6s, 12s), then stops. Skipped entirely when health endpoint reports degraded.
4. **Polling suppression**: Background polling and visibility-triggered refreshes disabled when showing stale data.
5. **Preference sync backoff**: Stops pushing after 3 consecutive failures.
6. **Health banner**: `DegradedBanner` component pings `/api/health` periodically.

Implementation: `src/lib/stale-cache.ts`, `src/hooks/useHealthStatus.ts`, `src/components/shared/StaleBanner.tsx`.

## Security

### Headers (`next.config.ts`)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'`; connect to `sda.dock108.dev`; scripts from `plausible.io` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | 2 years, includeSubDomains, preload |
| `Permissions-Policy` | No camera, microphone, geolocation |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `off` |
| `Cache-Control` | `no-store` (API routes only) |

### SEO & Discoverability

- `robots.ts` — blocks `/api/`, `/auth/`, `/profile`, `/settings`, `/history`, admin analytics routes
- `sitemap.ts` — lists public pages with priority and change frequency
- `manifest.ts` — PWA web manifest (installable, standalone display)
- Game detail pages have dynamic OG images via `opengraph-image.tsx`
- Root layout includes OpenGraph, Twitter card, and JSON-LD WebApplication schema

### Analytics

Dual analytics: self-hosted + Plausible. No cookies. IPs anonymized.

**Self-hosted** (`src/lib/analytics.ts`): events sent via `sendBeacon` to `/api/analytics-event`, logged as structured JSON to stdout.

**Plausible**: script loaded in root layout. `trackEvent()` sends to both systems.

Events tracked: `reveal_score`, `game_view`, `scroll_50`, `scroll_90`, `feedback_up`, `feedback_down`, `signup_gate_click`, `simulation_run`, `login_success`, `signup_success`, `token_refresh_error`.

## Sports Supported

NBA, NCAAB, NFL, NCAAF, MLB, NHL, PGA Tour (Golf).

Sport-specific stat groups configured in `src/lib/team-stats-config.ts`. Stat display supports normalized path (`buildGroupsFromNormalized()`) and a legacy fallback using hardcoded stat group definitions.

# Architecture

## Overview

This is a **read-only frontend** — it displays sports data but does not scrape, ingest, or store it. All data comes from a single backend API (`sports-data-admin.dock108.ai`). The frontend handles caching, realtime updates, and user preferences locally.

```
Browser ──► Next.js App (port 3001) ──► Backend API
              │                            │
              ├─ API proxy routes           ├─ Game data
              ├─ WebSocket / SSE           ├─ FairBet odds
              ├─ Zustand stores            ├─ Golf data
              └─ localStorage              ├─ Auth
                                           └─ Preference sync
```

## API Proxy Layer

All backend calls go through Next.js API routes (`src/app/api/`). These inject the `X-API-Key` header server-side so the API key never reaches the browser.

### Game & FairBet Routes

| Route | Backend Endpoint | Purpose |
|-------|-----------------|---------|
| `GET /api/games` | `/api/admin/sports/games` | Game list by date range |
| `GET /api/games/[id]` | `/api/admin/sports/games/:id` | Game detail (stats, odds, PBP) |
| `GET /api/games/[id]/flow` | `/api/admin/sports/games/:id/flow` | Narrative flow blocks |
| `GET /api/fairbet/odds` | `/api/fairbet/odds` | Pre-game EV analysis |
| `GET /api/fairbet/live/games` | `/api/fairbet/live/games` | Live game discovery |
| `GET /api/fairbet/live` | `/api/fairbet/live` | Live game odds |
| `GET /api/realtime/sse` | `/v1/sse` | SSE proxy (EventSource can't set headers) |
| `* /api/auth/[...path]` | `/auth/*` | Auth passthrough (login, signup, etc.) |

### Golf Routes

| Route | Backend Endpoint | Purpose |
|-------|-----------------|---------|
| `GET /api/golf/tournaments` | `/api/golf/tournaments` | Tournament list |
| `GET /api/golf/tournaments/[eventId]` | `/api/golf/tournaments/:eventId` | Tournament detail |
| `GET /api/golf/tournaments/[eventId]/leaderboard` | `/api/golf/tournaments/:eventId/leaderboard` | Leaderboard |

### Analytics Routes

| Route | Backend Endpoint | Method | Purpose |
|-------|-----------------|--------|---------|
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

### Health

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Returns `{ status, timestamp, version }`. Pings backend — returns `"degraded"` if unreachable. |

Server-side API configuration lives in `src/lib/api-server.ts`. Client-side fetch wrapper in `src/lib/api.ts`.

## Data Flow

### Game List (Home Page)

1. `useGamesList` hook fetches games for yesterday + today (Eastern timezone)
2. Response cached in `game-data` Zustand store (normalized by game ID)
3. Realtime subscription to `games:<league>:<date>` channels patches live scores
4. Visibility refresh: re-fetches when tab returns after 5+ seconds away
5. Sorting: live games first, then upcoming, then finals

### Game Detail

1. `useGameDetail` hook fetches full detail (stats, PBP, odds)
2. Cached with 5-minute TTL per game
3. Realtime subscriptions to `game:<id>:summary` and `game:<id>:pbp`
4. PBP subscription only active when Timeline section is expanded
5. Reading position saved on scroll, restored on return

### FairBet

1. `useFairBetOdds` fetches all pages of odds data (100 per page, max 3 concurrent)
2. Client-side enrichment adds display labels, title-casing, fair odds fallbacks
3. 3-minute cache TTL, 90-second fresh threshold (silent background refresh)
4. Live odds (auth-gated) poll every 15 seconds

### Golf

1. `useGolfTournaments` fetches tournament list, groups by status (This Week / Upcoming / Recent)
2. `useGolfLeaderboard` fetches leaderboard for a tournament with 60-second polling
3. Tournament data refreshed every 5 minutes

### Score Reveal

Two modes controlled by `scoreRevealMode` setting:
- **onMarkRead** (default): scores hidden until user clicks Reveal
- **always**: scores always visible

When Following Live mode is active, it overrides to "always" for continuous updates.

## Component Organization

```
components/
  auth/         # AuthGate (role-based access control), AuthProvider
  fairbet/      # BetCard, ParlaySheet, LiveOddsPanel, ExplainerModal
  game/         # GameHeader, Timeline, TeamStats, PlayerStats, FlowSection, etc.
  golf/         # TournamentCard, Leaderboard, LeaderboardRow
  history/      # DateNavigator
  home/         # GameRow, PinnedBar, SearchBar
  layout/       # TopNav, BottomTabs, SettingsDrawer
  settings/     # SettingsContent
  shared/       # FormPrimitives, LoadingSkeleton, SectionHeader, CollapsibleSection
```

```
features/
  analytics/
    components/  # AnalyticsTabNav, ProbabilityBar, ScoreCard, PABreakdown, LineupBuilder, SimulatorResults, PitcherProfile
    services/    # SimulatorService, ModelsService, BatchService, ProfilesService
```

## Auth Model

- JWT Bearer tokens stored in Zustand (`sd-auth` localStorage key)
- Roles: `guest` (unauthenticated), `user`, `admin`
- Token validated on app load via `GET /api/auth/me`; invalid token triggers auto-logout
- Preference sync starts after successful login, stops on logout
- Auth state forwarded to backend via `Authorization` header on proxied requests

## Analytics

The analytics section is organized under a `(mlb)` Next.js route group that shares a tab navigation bar across all 4 pages.

### Navigation

`AnalyticsTabNav` renders a horizontal scrollable tab bar. Admin-only tabs are hidden for non-admin users via role check.

| Tab | Route | Min Role |
|-----|-------|----------|
| Simulator | `/analytics/simulator` | user |
| Profiles | `/analytics/profiles` | user |
| Models | `/analytics/models` | admin |
| Batch Sims | `/analytics/batch` | admin |

`/analytics/mlb` redirects to `/analytics/simulator` for backward compatibility.

### Pages

**Simulator** — Lineup-aware Monte Carlo plate appearance simulator. Users select home/away teams, customize 9-man batting orders and starting pitchers, then run 10,000-iteration simulations. Results show win probabilities, expected scores, likely final scores, and PA profiles.

**Profiles** — Team performance profiles with rolling window selection (7/14/30/60 days). Metrics displayed with league baselines for comparison. Supports multi-team side-by-side comparison. Data coverage panel shows available game count and date range.

**Models** (admin) — Training job monitoring with status polling, model registry with activation toggle, calibration reports, and degradation alerts.

**Batch Sims** (admin) — Launch batch simulations by date with configurable iterations. Jobs table with expandable summaries. Prediction outcome tracking with correct/incorrect classification.

### Service Layer

Each analytics page has a corresponding service in `src/features/analytics/services/` following the pattern from `SimulatorService.ts`: client-side functions calling `fetchApi()` to hit the proxy API routes.

## Sports Supported

NBA, NCAAB, NFL, NCAAF, MLB, NHL, PGA Tour (Golf).

Sport-specific stat groups are defined in `src/lib/team-stats-config.ts`. The stat display system supports two paths: a normalized path using `buildGroupsFromNormalized()` when the API provides `normalizedStats`, and a legacy fallback using hardcoded stat group definitions when normalized data is unavailable.

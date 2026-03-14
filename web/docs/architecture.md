# Architecture

## Overview

This is a **read-only frontend** — it displays sports data but does not scrape, ingest, or store it. All data comes from a single backend API (`sports-data-admin.dock108.ai`). The frontend handles caching, realtime updates, and user preferences locally.

```
Browser ──► Next.js App (port 3001) ──► Backend API
              │                            │
              ├─ API proxy routes           ├─ Game data
              ├─ WebSocket / SSE           ├─ FairBet odds
              ├─ Zustand stores            ├─ Auth
              └─ localStorage              └─ Preference sync
```

## API Proxy Layer

All backend calls go through Next.js API routes (`src/app/api/`). These inject the `X-API-Key` header server-side so the API key never reaches the browser.

| Route | Backend Endpoint | Purpose |
|-------|-----------------|---------|
| `GET /api/games` | `/v1/games` | Game list by date range |
| `GET /api/games/[id]` | `/v1/games/:id` | Game detail (stats, odds, PBP) |
| `GET /api/games/[id]/flow` | `/v1/games/:id/flow` | Narrative flow blocks |
| `GET /api/fairbet/odds` | `/v1/fairbet/odds` | Pre-game EV analysis |
| `GET /api/fairbet/live/games` | `/v1/fairbet/live/games` | Live game discovery |
| `GET /api/fairbet/live` | `/v1/fairbet/live` | Live game odds |
| `GET /api/analytics/mlb-teams` | `/v1/analytics/mlb/teams` | MLB team list |
| `GET /api/analytics/mlb-roster` | `/v1/analytics/mlb/roster` | MLB roster data |
| `POST /api/analytics/simulate` | `/v1/analytics/simulate` | Run simulation |
| `GET /api/realtime/sse` | `/v1/sse` | SSE proxy (EventSource can't set headers) |
| `* /api/auth/[...path]` | `/v1/auth/*` | Auth passthrough (login, signup, etc.) |

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

### Score Reveal

Two modes controlled by `scoreRevealMode` setting:
- **onMarkRead** (default): scores hidden until user clicks Reveal
- **always**: scores always visible

When Following Live mode is active, it overrides to "always" for continuous updates.

## Component Organization

```
components/
  auth/         # Login form, signup form, magic link, reset password
  fairbet/      # BetCard, ParlaySheet, LiveOddsPanel, ExplainerModal
  game/         # GameHeader, Timeline, TeamStats, PlayerStats, FlowSection, etc.
  history/      # Historical game list
  home/         # GameRow, PinnedBar, ScoreZone, LeagueFilter, SearchBar
  layout/       # TopNav, BottomTabs, SettingsDrawer
  settings/     # Preference controls
  shared/       # FormPrimitives, LoadingSkeleton, SectionHeader, CollapsibleSection
```

## Auth Model

- JWT Bearer tokens stored in Zustand (`sd-auth` localStorage key)
- Roles: `guest` (unauthenticated), `user`, `admin`
- Token validated on app load via `GET /api/auth/me`; invalid token triggers auto-logout
- Preference sync starts after successful login, stops on logout
- Auth state forwarded to backend via `Authorization` header on proxied requests

## Sports Supported

NBA, NHL, MLB. The type system and stat display components handle all three leagues with sport-specific stat groups defined in `src/lib/team-stats-config.ts`.

# Architecture

## Overview

Scroll Down is a **read-only frontend** — it displays sports data but does not scrape, ingest, or store it. All data comes from a single backend API (`sda.dock108.dev`). The frontend handles caching, realtime updates, score reveal state, and user preferences locally.

```
Browser ──► Next.js App (port 3001) ──► Backend API (sda.dock108.dev)
              │                            │
              ├─ API proxy routes           ├─ Game scores & stats
              ├─ WebSocket / SSE            ├─ FairBet odds & EV
              ├─ Zustand stores             ├─ Golf tournaments
              └─ localStorage / IDB         ├─ Auth (JWT)
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
| `/api/analytics/forecasts/mlb` | `/api/analytics/forecasts/mlb` | GET | MLB forecast data (admin) |

**Simulator Routes**

| Route | Backend | Method | Purpose |
|-------|---------|--------|---------|
| `/api/simulator/[sport]/teams` | `/api/simulator/:sport/teams` | GET | Team list — sport whitelist: `mlb`, `nba`, `nhl`, `ncaab` (1hr ISR cache) |
| `/api/simulator/[sport]` | `/api/simulator/:sport` | POST | Run Monte Carlo simulation for any supported sport |

**History Routes**

| Route | Backend | Method | Purpose |
|-------|---------|--------|---------|
| `/api/history` | `/api/history` | GET | Historical game list with pagination |

**Tracking & Health**

| Route | Purpose |
|-------|---------|
| `POST /api/analytics-event` | Self-hosted analytics. Logs structured JSON to stdout (Docker captures). IPs anonymized. |
| `GET /api/health` | Returns `{ status, timestamp }`. Returns `"degraded"` if backend unreachable. |

**Local Auth Routes** (magic-link system — direct Next.js routes, not proxied to backend)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/send-link` | POST | Send magic-link email to the provided address |
| `/api/auth/verify` | GET | Verify magic-link token; create HttpOnly session cookie on success |
| `/api/auth/session` | GET | Return current session status from HttpOnly cookie |
| `/api/auth/sign-out` | POST | Invalidate session and clear cookie |

**AI Story Routes** (auth + rate-limited)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/story` | POST | Generate AI game narrative (uses `claude-haiku-4-5-20251001`) |
| `/api/ai/salient-events` | POST | Extract key events (lead changes, big plays) from box score |
| `/api/ai/verify` | POST | Fact-check story numbers against source box score data |
| `/api/story-feedback` | POST | Submit thumbs-up/down on a game story |

**Billing Routes** (Stripe)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/checkout` | POST | Create Stripe Checkout session for Pro upgrade |
| `/api/billing/portal` | POST | Open Stripe Customer Portal (manage/cancel subscription) |
| `/api/billing/webhook` | POST | Handle Stripe webhook events (subscription updates, cancellations) |
| `/api/billing/info` | GET | Fetch current user's billing and subscription status |

**Sync Routes** (Pro-tier)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sync/reveal` | POST | Sync revealed game IDs and snapshots cross-device (Pro users only) |

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
| `auth` | `sd-auth` | Yes | JWT token, role, email, userId (legacy JWT system) | — |
| `session` | — | No | HttpOnly cookie session: status, email, tier, userId (magic-link system) | — |
| `tier` | `sd-tier` | Yes | Free/pro tier, anonymous ID, `isAllowed(feature)` gate evaluation | — |
| `settings` | `sd-settings` | Yes | Theme, reveal mode, odds format, sportsbook, etc. | 20 leagues, 100 teams |
| `reveal` | IndexedDB (`scroll-down` DB) | Yes (IDB; one-shot migration from legacy `sd-read-state` localStorage key) | Revealed game IDs + score snapshots | 500 IDs, 20 snapshots |
| `pinned-games` | `sd-pinned-games` | Yes | Pinned game IDs + team abbreviations | 10 games |
| `reading-position` | `sd-reading-position` | Yes | Per-game play index for timeline resume | 50 positions, 30-day age |
| `section-layout` | `sd-section-layout` | Yes | Per-game section expand/collapse state | 50 layouts |
| `my-bets` | `sd-my-bets` | Yes | Saved bet records with outcomes tracking | 200 bets |
| `home-scroll` | — | No | Home page scroll Y position | — |
| `ui` | — | No | Ephemeral UI state (settings drawer) | — |
| `pro-gate-sheet` | — | No | UI state for Pro upgrade sheet (open/close, triggering feature key) | — |

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
| `useHistoricalGames` | Historical game pagination | — |
| `useScoreDisplay` | Compute score visibility from settings | Derived |
| `useAutoRetry` | Exponential backoff on error | — |
| `useVisibilityRefresh` | Re-fetch when tab returns after 5+ seconds | — |
| `useHealthStatus` | Backend health check | — |
| `useFreshnessLabel` | Compute freshness label from timestamp | Derived |
| `useProGate` | Evaluate Pro feature gates for a given key | Derived |
| `useIsPro` | Boolean shortcut for Pro tier (reads `tier` store) | Derived |

### 5. Score Reveal System

The product's core differentiator. Two modes controlled by `scoreRevealMode` setting:

- **`onMarkRead`** (default): Scores hidden until user explicitly clicks Reveal
- **`always`**: Scores always visible (traditional scoreboard behavior)

**Following Live** mode overrides to `always` for continuous live updates.

**Blacklist**: Users can hide scores by league or team (`scoreHideLeagues`, `scoreHideTeams`).

**Snapshots**: When a user reveals a game, the current score/period/clock is captured. If the live score later differs from the snapshot, an UPDATE indicator appears — "new data since you last looked."

**Persistence**: Reveal state is stored in IndexedDB (`sd-read-state`) via `lib/reveal-idb.ts`. IndexedDB is accessible to the service worker, enabling offline persistence and future background sync.

Implementation: `src/stores/reveal.ts`, `src/lib/score-display.ts`, `src/lib/score-hide.ts`, `src/hooks/useScoreDisplay.ts`.

### 6. Auth Model

The app has two coexisting auth systems:

**Legacy JWT system** (`stores/auth.ts`): JWT Bearer tokens in localStorage (`sd-auth`). Token validated on load via `GET /api/auth/me`; invalid → auto-logout. Used by the `/api/auth/[...path]` proxy which forwards to the backend.

**Magic-link / session cookie system** (`stores/session.ts`, `stores/tier.ts`): Email magic-link auth handled entirely within Next.js (no backend proxy). Session stored in an HttpOnly cookie. On load, `SessionProvider` calls `GET /api/auth/session` to hydrate the `session` store. Roles/tier available from the `tier` store.

Both systems run in parallel during transition. New sign-in flows use the magic-link system.

**Auth Proxy Security** (legacy JWT proxy)

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

**Magic-link Auth Rate Limiting**: `POST /api/auth/send-link` allows 5 requests per IP per 10 minutes (`AUTH.SEND_LINK_RATE_MAX`). Magic-link tokens expire after 15 minutes (`AUTH.MAGIC_TOKEN_TTL_MS`). Sessions last 30 days (`AUTH.SESSION_TTL_S`).

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
| Forecasts | `/analytics/forecasts` | admin |
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
│   ├── api/                # API proxy routes (games, fairbet, golf, auth, analytics, simulator, billing, ai, history, sync)
│   ├── game/[id]/          # Game detail page + OG image generation
│   ├── fairbet/            # Betting odds discovery
│   ├── golf/               # Golf tournaments & leaderboard
│   ├── analytics/          # ML analytics (admin/power-user)
│   ├── auth/               # Login, signup, magic-link, password reset
│   ├── history/            # Historical games viewer
│   ├── account/            # User account page
│   ├── settings/           # User preferences + /settings/my-bets (bet tracker)
│   └── (legal)             # /privacy, /terms, /contact
│
├── components/
│   ├── account/            # AccountContent
│   ├── ads/                # AdSenseScript, AdSlot, FeedAd, GameDetailAd, FairBetAd
│   ├── auth/               # AuthProvider, AuthGate, SessionProvider
│   ├── fairbet/            # BetCard, BookFilters, LiveOddsPanel, ParlaySheet, ExplainerSheet,
│   │                       # BookChip, BookComparisonRow, ProGateSheet
│   ├── game/               # GameHeader, Timeline, Stats, Odds, Flow, WrapUp, Social, GameStorySection (22 components)
│   ├── golf/               # Leaderboard, TournamentCard, LeaderboardRow
│   ├── history/            # HistoryGateOverlay
│   ├── home/               # GameRow, PinnedBar, SearchBar, TimelineSection, RevealOnboarding
│   ├── layout/             # TopNav, BottomTabs, Footer, SettingsDrawer, RealtimeProvider, ThemeProvider,
│   │                       # BetaBanner, OfflineBanner, PWAInstallPrompt, RevealIDBProvider
│   ├── settings/           # SettingsContent, ScoreHideBlacklistControls
│   └── shared/             # Spinner, LoadingSkeleton, SectionHeader, CollapsibleSection, StaleBanner
│
├── features/
│   └── analytics/          # MLB analytics feature
│       ├── components/     # AnalyticsTabNav, ProbabilityBar, ScoreCard, LineupBuilder, SimulatorResults
│       └── services/       # SimulatorService, PublicSimulatorService, ModelsService, BatchService,
│                           # ForecastsService, ProfilesService
│
├── hooks/                  # Data fetching & derived hooks (16 hooks)
├── stores/                 # Zustand state management (14 stores)
├── realtime/               # WebSocket/SSE transport, dispatcher, channel naming, hooks
└── lib/                    # Utilities (api, types, config, date, score-hide, fairbet-utils, pro-gate,
                            # magic-link, story-templates, story-validator, salient-events, reveal-idb, etc.)
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

Defined in `web/next.config.ts`. Applied to all responses unless noted.

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'`. `script-src` adds `'unsafe-inline'`, `plausible.io`, `partners.draftkings.com`, `affiliates.betmgm.com`, and the AdSense script origins (`pagead2.googlesyndication.com`, `partner.googleadservices.com`, `adservice.google.com`, `tpc.googlesyndication.com`, `googleads.g.doubleclick.net`, `securepubads.g.doubleclick.net`, `www.googletagservices.com`, `www.gstatic.com`). `connect-src` adds `plausible.io`, `sda.dock108.dev` + `wss://sda.dock108.dev`, `api.stripe.com`, the DraftKings/BetMGM affiliate hosts, and the AdSense network hosts. `frame-src` adds `js.stripe.com`, `hooks.stripe.com`, and the AdSense iframe hosts. `frame-ancestors 'none'` blocks embedding. |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | 2 years, includeSubDomains, preload |
| `Permissions-Policy` | No camera, microphone, geolocation |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `off` |
| `Cache-Control` | `no-store` (API routes only) |

`'unsafe-inline'` on `script-src` is currently load-bearing for Next.js inline boot scripts and the AdSense `<ins>` push call. Replacing it with a nonce-based CSP is tracked as a follow-up in `docs/audits/security-report.md`.

### SEO & Discoverability

- `robots.ts` — blocks `/api/`, `/auth/`, `/account`, `/settings`, `/history`, admin analytics routes
- `sitemap.ts` — lists public pages with priority and change frequency
- `manifest.ts` — PWA web manifest (installable, standalone display)
- Game detail pages have dynamic OG images via `opengraph-image.tsx`
- Root layout includes OpenGraph, Twitter card, and JSON-LD WebApplication schema

### Analytics

Dual analytics: self-hosted + Plausible. No cookies. IPs anonymized.

**Self-hosted** (`src/lib/analytics.ts`): events sent via `sendBeacon` to `/api/analytics-event`, logged as structured JSON to stdout.

**Plausible**: script loaded in root layout. `trackEvent()` sends to both systems.

Events emitted: `reveal_score`, `game_view`, `scroll_50`, `scroll_90`, `feedback_up`, `feedback_down`, `signup_gate_click`, `simulation_run`, `login_success`, `signup_success`, `token_refresh_error`, `profile_hydrate_error`.

## Sports Supported

NBA, NCAAB, NFL, NCAAF, MLB, NHL, PGA Tour (Golf).

Sport-specific stat groups configured in `src/lib/team-stats-config.ts`. Stat display supports normalized path (`buildGroupsFromNormalized()`) and a legacy fallback using hardcoded stat group definitions.

## Billing & Freemium Tier

The app has a Pro tier implemented via Stripe alongside an anonymous tier tracking system.

**Tier store** (`stores/tier.ts`, persisted: `sd-tier`): Tracks `tier: "free" | "pro"` and `anonId` (UUID). On hydration, syncs both values to cookies for server-side access. `isAllowed(feature)` evaluates Pro feature gates against `FEATURE_GATES` keys.

**Session store** (`stores/session.ts`, not persisted): Hydrated on load by `SessionProvider` via `GET /api/auth/session`. Provides `status`, `email`, `tier`, and `userId` from the HttpOnly session cookie.

**Feature gates** (`FEATURE_GATES` in `src/lib/config.ts`): Canonical keys — `live_odds`, `full_fairbet`, `all_books`, `all_markets`, `cross_device_sync`, `advanced_filters`, `line_movement`, `ev_simulator`, `clv_tracking`, `win_probability`, `history`. All server routes and client hooks that enforce a paywall reference these keys via `lib/pro-gate.ts` and `hooks/useProGate.ts`.

**Pro gate sheet** (`components/fairbet/ProGateSheet.tsx`, store: `pro-gate-sheet.ts`): Global bottom-sheet overlay shown when a free-tier user hits a gated feature. Renders the specific feature name as context for the upgrade CTA.

**Billing routes** (Stripe): `POST /api/billing/checkout` creates a Checkout session, `POST /api/billing/portal` opens Customer Portal, `POST /api/billing/webhook` handles subscription lifecycle events, `GET /api/billing/info` returns current subscription status.

**Ads** (`components/ads/`, SSOT in `lib/ads/`): manual Google AdSense slots for free-tier viewers only. The loader `<Script>` mounts in the root layout via `AdSenseScript`; named slot components (`FeedAd` for the home Today feed, `GameDetailAd` for `/game/[id]`, `FairBetAd` for `/fairbet`) render an `<AdSlot>` per placement. Every visible-ad decision flows through `shouldShowAds()` in `lib/ads/entitlements.ts` via the `useAdGate()` hook — paid (`tier=pro`) and admin viewers never load the AdSense script and never see an `<ins>` tag. Slot IDs and the kill switch are read once in `lib/ads/config.ts` (`NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_ADSENSE_*`). Placement constants in `lib/config.ts` (`ADS.TOP_FEED_AFTER_INDEX`, `ADS.MID_FEED_AFTER_INDEX`). `ads.txt` ships as a static file at `web/public/ads.txt` (served at `/ads.txt`). Ads never appear between live game rows, during the reveal gesture, or inside FairBet bet rows / play-by-play. See [ADS_SETUP.md](ADS_SETUP.md) for full setup, env vars, and verification steps.

## My Bets Tracker

Users can save and track their own bets via `/settings/my-bets`.

**Store** (`stores/my-bets.ts`, persisted: `sd-my-bets`): Saved bet records with outcomes. Max 200 entries (`MAX_MY_BETS` in `config.ts`).

**Routes**:
- `/settings/my-bets` — main bet tracker dashboard
- `/settings/my-bets/dashboard` — detailed outcomes view

**Backend**: Uses `/api/analytics/prediction-outcomes` and `/api/analytics/record-outcomes` for recording and fetching outcomes.

## PWA & Offline

Core PWA infrastructure is live. Background sync and cross-device sync are not yet implemented.

- **Service worker** (`/public/sw.js`): Cache First for static assets, Stale-While-Revalidate for game data.
- **Reveal state in IndexedDB**: `lib/reveal-idb.ts` migrates reveal state from localStorage to IndexedDB for service-worker accessibility and larger capacity.
- **Install prompt**: `PWAInstallPrompt` shown after `PWA.INSTALL_MIN_SESSIONS` (2) sessions.
- **Offline indicator**: `OfflineBanner` auto-dismisses after `PWA.OFFLINE_AUTO_DISMISS_MS` (3s) on reconnect.

## AI Game Story

Infrastructure is implemented but hidden behind `STORY_QUALITY_GATE = true` in `config.ts`. No stories are shown until a quality review passes.

**Routes** (auth + rate-limited):
- `POST /api/ai/story` — generates a short game narrative using `claude-haiku-4-5-20251001`
- `POST /api/ai/salient-events` — extracts key events (lead changes, big plays) from box score
- `POST /api/ai/verify` — fact-checks all numbers in a story against source box score
- `POST /api/story-feedback` — submits thumbs-up/down feedback on a story

**Client libraries**: `lib/story-templates.ts`, `lib/story-validator.ts`, `lib/story-numeric-verifier.ts`, `lib/salient-events.ts`.

**Quality controls** (`AI_STORY` in `config.ts`):
- `BANNED_PHRASES` — generic filler phrases that cause immediate rejection
- `MAX_SENTENCES: 6`, `MAX_SENTENCES_PER_SECTION: 2`, `MAX_WORDS: 150` — output budgets
- `STORY_QUALITY_GATE: true` — when true, `GameStorySection` renders nothing

To enable stories: review 50+ generated stories. If filler/inaccuracy rate is <20%, set `STORY_QUALITY_GATE = false` in `config.ts`.

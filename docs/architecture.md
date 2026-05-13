# Architecture

## Overview

Scroll Down MLB is a **read-only frontend** for one product surface: spoiler-free MLB catch-up. It does not scrape, ingest, or store game data. All data comes from a single backend API (`sda.dock108.dev`); the frontend selects key plays, plans deck rhythm, renders the field/runner/trajectory visuals, and tracks per-game progress locally.

```
Browser ──► Next.js App (port 3001) ──► Backend API (sda.dock108.dev)
              │                            │
              ├─ /api/* proxy routes        ├─ Game list & detail
              ├─ Card-build pipeline         └─ Per-game gameflow recap
              ├─ Zustand stores (3)
              └─ localStorage
```

**Stack** (verified from `web/package.json`): Next.js 16 · React 19 · TypeScript 6 · Zustand 5 · Tailwind CSS 4 · Vitest 4 · Playwright 1.59. There is no auth library, payment library, realtime library, or AI SDK in dependencies.

## Routes (App Router)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `web/src/app/page.tsx` | Spoiler-free MLB games feed (last 48h + today). Renders `HomePageClient`. |
| `/catchup/[gameId]` | `web/src/app/catchup/[gameId]/page.tsx` | Single-game catch-up viewer. Renders `CatchupExperience`. |
| `/dev/catchup-lab` | `web/src/app/dev/catchup-lab/page.tsx` | **Dev-only** internal review tool. Lists captured fixtures and renders any fixture's deck with planner audit + report panel. The route group `web/src/app/dev/layout.tsx` returns 404 in production. |
| `/settings` | `web/src/app/settings/page.tsx` | Theme + stale-banner toggle. |
| `/contact`, `/privacy`, `/terms` | static pages | Boilerplate. |

## API Routes

All upstream calls go through Next.js API routes; the proxy injects `X-API-Key` server-side via `apiFetch()` in `web/src/lib/api-server.ts`.

| Route | Upstream | Purpose | Cache (config.ts) |
|-------|----------|---------|-------------------|
| `GET /api/health` | `/api/admin/sports/games?limit=1` | Liveness check used by `DegradedBanner`. Skipped when `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1`. | `API.HEALTH_CACHE_MS` (30s in-memory) |
| `GET /api/games/recent` | `/api/admin/sports/games?...` | Spoiler-free game list (last 48h + today). Strips score and win fields server-side; accepts `team` filter. | `GAMES_BFF_FRESH_MS` (15s) / `GAMES_BFF_STALE_MS` (5m) |
| `GET /api/games/[gameId]/cards` | `/api/admin/sports/games/{id}` | Builds the catch-up card deck for one game via `buildCatchupCards`. Accepts `?since=<playIndex>` for incremental live polls and `?debug=true` for the planner audit. Non-MLB games return 404. | live: 10s/3m · final: 24h/7d |
| `GET /api/games/[gameId]/summary` | `/api/admin/sports/games/{id}` + `/api/admin/sports/games/{id}/gameflow` | Final score + gameflow recap shown on the FinalReveal screen. Gameflow path overridable via `SPORTS_GAMEFLOW_PATH`. | `SUMMARY_BFF_FRESH_MS` (24h) / `SUMMARY_BFF_STALE_MS` (7d) |
| `GET /api/dev/fixtures` | — | **Dev-only.** Lists captured test fixtures from `web/tests/fixtures/games/_manifest.json`. 404 in production. | none |
| `GET /api/dev/fixtures/[id]/cards` | — | **Dev-only.** Renders a captured fixture through `buildCatchupCards` with the planner report attached. 404 in production. | none |

`web/src/lib/api-server.ts` provides `apiFetch` (5s timeout default) and `cachedApiFetch` (in-memory LRU, max `API.BFF_CACHE_MAX_ENTRIES = 100`) with stale-if-error fallback for 429/5xx upstream responses. UTF-8 mojibake repair (`fixMojibake`) is applied to all JSON string fields at the data boundary.

## Catch-up Pipeline

The product's core differentiator. Implemented as three pure stages so the dev `/dev/catchup-lab` page can run the same code on captured fixtures.

```
upstream game + plays  ─►  buildCatchupCards()  ─►  planDeckWithReport()  ─►  rendered deck
                          (lib/catchup-cards)     (lib/rhythm-planner)
```

1. **Select** — `web/src/lib/catchup-cards.ts` picks scoring + late-game high-leverage plays (always included) and deterministically samples lower-tier plays so the deck stays inside `CATCHUP.SOFT_MIN..HARD_MAX` (5..18, target 12). Each card carries an audit trail explaining inclusion.
2. **Plan rhythm** — `web/src/lib/rhythm-planner.ts` orders cards into half-inning summaries and individual play beats, returning `{ deck, report }`. The report explains every ordering decision.
3. **Render** — `web/src/components/catchup/*`:
   - `SceneSetterCard` — matchup, venue, probable pitchers (title card)
   - `RhythmCard` — half-inning summary with run delta
   - `CatchupCard` — individual play, with `BaseballLightField` (field + runner paths + trajectory) and `CardNarrative` text
   - `FinalReveal` — locked until scroll reaches the end; tap reveals score + gameflow recap

Supporting libraries:

| Module | Purpose |
|--------|---------|
| `web/src/lib/leverage.ts` | Win Expectancy delta per play; ranks tier-2 candidates |
| `web/src/lib/play-phases.ts` | Phase boundaries inside a play (pitch / contact / movement / settle) |
| `web/src/lib/field-geometry.ts` | Single source of truth for field coordinates (foul lines, base spacing, mound, outfield arc) |
| `web/src/lib/runner-paths.ts` | Runner movement paths between bases |
| `web/src/lib/trajectory.ts` | Batted-ball arcs (asymmetric apex, lateral bias per pitch class) |
| `web/src/lib/result-chip.ts` | Event personality / leverage tier for the result chip |
| `web/src/lib/narrative.ts` | Prose for individual plays (used by `CardNarrative`) |

## Zustand Stores

All three live under `web/src/stores/` and use `persist` middleware. There are no in-memory-only stores; there is no preference sync, no auth store, no realtime sequence state.

| Store | File | Persisted key | Version | Purpose |
|-------|------|---------------|---------|---------|
| `useSettings` | `stores/settings.ts` | `sd-settings` | 2 | `theme` (`system`/`light`/`dark`), `showStaleBanners`. Migration from v1 strips legacy fields (score-reveal mode, blacklists, timeline tiers, follow-live, odds format, etc.). |
| `useOnboarding` | `stores/onboarding.ts` | `sd-onboarding` | 1 | `onboarded`, `favoriteTeam` (3-letter MLB abbr or `null` if user skipped). |
| `useCatchupProgress` | `stores/catchup-progress.ts` | `sd-catchup-state` | 1 | Per-game `{ cardIndex, completed, lastSeenPlayIndex, updatedAt }`. Auto-prunes entries older than `STORAGE.CATCHUP_MAX_AGE_DAYS` (60d) or beyond `STORAGE.MAX_CATCHUP_ENTRIES` (200). |

`lastSeenPlayIndex` becomes the `?since=` parameter on the next live cards poll.

## Data-Fetching Hooks

Polling-only. There is no WebSocket or SSE. Files: `web/src/hooks/`.

| Hook | Endpoint | Cadence |
|------|----------|---------|
| `useHealthStatus` (`useHealthDegraded`) | `/api/health` | Reads module-level state via `useSyncExternalStore`; backed by `DegradedBanner` polling |
| `useGamesList` | `/api/games/recent` | 60s (`POLLING.GAMES_REFRESH_MS`) when tab is foregrounded; refetches on visibility change |
| `useCatchupCards` | `/api/games/[gameId]/cards` | 45s (`POLLING.LIVE_CARDS_POLL_MS`) when game is live and tab is foregrounded; uses `?since=` for incremental fetch |

## Layout & Provider Composition

`web/src/app/layout.tsx` mounts (in order): `ThemeProvider` → `AnalyticsProvider` (Suspense-wrapped pageview tracker) → `OfflineBanner` · `PWAInstallPrompt` · `BetaBanner` · `DegradedBanner` · `TopNav` → `FirstVisitGate` (renders `TeamPickerOverlay` until `useOnboarding.onboarded`) → page → `Footer`.

The Plausible script loads via `next/script` with `data-domain` defaulting to the site host (or `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`). A `JSON-LD` `WebApplication` block is emitted in `<head>`. The service worker at `/sw.js` is registered on non-localhost hosts; on `localhost`/`*.local` the registration is unregistered and caches cleared (avoids dev-mode SW pollution).

## Analytics

`web/src/lib/analytics.ts` exposes `trackPageview()` and `trackEvent()` as thin bridges to `window.plausible(...)`. Plausible is the only analytics sink in this repo; the helpers no-op on the server, before the script loads, or when the script is blocked. `initScrollTracking()` fires `scroll_50` and `scroll_90` once per page load.

## Security Headers

Set in `web/next.config.ts`. Applied to all responses; API routes additionally get `Cache-Control: no-store`.

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://plausible.io` (plus `'unsafe-eval'` in dev for React Refresh); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `connect-src 'self' https://plausible.io https://sda.dock108.dev wss://sda.dock108.dev` (plus `ws://localhost:*`/`http://localhost:*` in dev); `worker-src 'self'`; `frame-ancestors 'none'`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`. |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | 2 years, includeSubDomains, preload |
| `Permissions-Policy` | No camera, microphone, geolocation |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `off` |

`'unsafe-inline'` on `script-src` is load-bearing for Next.js inline boot scripts; `wss://sda.dock108.dev` is allowed in `connect-src` despite the app not using WebSockets today (defensive). The CSP origin list does not include any AdSense, Stripe, or DraftKings/BetMGM hosts — those features were removed in the MLB-only pivot.

## SEO & Discoverability

- `web/src/app/robots.ts` — `Disallow: /api/`, `/dev/`, `/settings`. When `isNoIndexSite()` returns true (e.g. `scrolldownsports.dev` or `SITE_NOINDEX=true`) the file blocks all crawling.
- `web/src/app/sitemap.ts` — public pages only, omitted on noindex sites.
- `web/src/app/manifest.ts` — PWA manifest (installable, standalone display).
- `web/src/lib/seo.ts` / `seo-data.ts` — JSON-LD helpers used by the root layout and home page.
- Canonical origin is resolved by `web/src/lib/site-config.ts` (`getSiteUrl`) from `PUBLIC_BASE_URL` / `SITE_URL`, falling back to `scrolldownsports.com` in production and `scrolldownsports.dev` otherwise.

## PWA & Offline

- `web/public/sw.js` — service worker (registered by inline script in root layout)
- `web/public/offline.html` — offline fallback page
- `BetaBanner`, `OfflineBanner`, `PWAInstallPrompt` — surface state via `localStorage` keys (`sd-pwa-install-dismissed`, `sd-pwa-session-count`); install prompt appears after `PWA.INSTALL_MIN_SESSIONS` sessions; offline banner auto-dismisses `PWA.OFFLINE_AUTO_DISMISS_MS` after reconnect

## Degraded-State Handling

When the backend is unavailable:

1. `cachedApiFetch` returns the most recent cached response if it's within the per-route stale window and the upstream error is 429/5xx (`isFallbackEligible`).
2. `/api/health` returns `503` with `{status: "degraded"}` after `API.HEALTH_BACKEND_PING_TIMEOUT_MS` (15s).
3. `DegradedBanner` polls `/api/health` and surfaces a banner when degraded; `useHealthStatus` exposes the bit to other components.
4. `useSettings.showStaleBanners` toggles whether the user sees stale-data indicators — defaults to `true`.

## Sports Supported

MLB only. `LEAGUE = "mlb"` in `web/src/lib/config.ts:10` is enforced server-side at the cards/summary proxy boundary; non-MLB games return 404.

## Directory Structure

```
web/src/
├── app/
│   ├── api/
│   │   ├── dev/fixtures/          # /api/dev/fixtures, /api/dev/fixtures/[id]/cards  (dev-only)
│   │   ├── games/[gameId]/cards/  # /api/games/[gameId]/cards
│   │   ├── games/[gameId]/summary/# /api/games/[gameId]/summary
│   │   ├── games/recent/          # /api/games/recent
│   │   └── health/                # /api/health
│   ├── catchup/[gameId]/          # /catchup/[gameId]
│   ├── dev/catchup-lab/           # /dev/catchup-lab (dev-only via dev/layout.tsx)
│   ├── settings/                  # /settings
│   ├── contact/, privacy/, terms/ # static pages
│   ├── layout.tsx                 # root layout: providers, banners, nav
│   ├── page.tsx                   # /
│   ├── manifest.ts, robots.ts, sitemap.ts
│   └── globals.css
├── components/
│   ├── catchup/                   # BaseballLightField, CatchupCard, RhythmCard, FinalReveal,
│   │                              # SceneSetterCard, CatchupExperience, CatchupScrollContainer,
│   │                              # CatchupProgress, RevealGate, CardNarrative
│   ├── home/                      # HomePageClient, GameRow
│   ├── layout/                    # TopNav, Footer, ThemeProvider, AnalyticsProvider,
│   │                              # BetaBanner, DegradedBanner, OfflineBanner, PWAInstallPrompt
│   ├── onboarding/                # FirstVisitGate, TeamPickerOverlay
│   ├── seo/                       # SpoilerFreeGameList
│   ├── settings/                  # SettingsContent
│   └── shared/                    # Spinner, LoadingSkeleton, SectionHeader, CollapsibleSection,
│                                  # FormPrimitives
├── hooks/                         # useGamesList, useCatchupCards, useHealthStatus
├── stores/                        # settings, onboarding, catchup-progress
└── lib/                           # api-server, api, catchup-cards, rhythm-planner, leverage,
                                   # play-phases, play-validation, narrative, runner-paths,
                                   # trajectory, field-geometry, result-chip, mlb-teams,
                                   # game-filters, date-utils, site-config, seo,
                                   # seo-data, top-banner-slot, rate-limit, analytics, types,
                                   # config, utils
```

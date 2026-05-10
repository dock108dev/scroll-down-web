# Development

Guide for local development, debugging, and manual QA.

---

## Setup

```bash
cd web
cp .env.local.example .env.local   # set SPORTS_DATA_API_KEY
npm ci
npm run dev                         # http://localhost:3001
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SPORTS_DATA_API_KEY` | Yes | Sent as `X-API-Key` to the upstream backend. Server-side only. |
| `SPORTS_API_INTERNAL_URL` | No | Override the backend URL (default: `https://sda.dock108.dev`, hardcoded in `web/src/lib/config.ts`). |
| `SPORTS_GAMEFLOW_PATH` | No | Override the per-game gameflow recap path (default: `/api/admin/sports/games/{id}/gameflow`). |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | No | Plausible `data-domain`. Defaults to the site host. |
| `PUBLIC_BASE_URL` / `SITE_URL` | No | Canonical origin for SEO metadata. Defaults to `scrolldownsports.com` in production, `scrolldownsports.dev` otherwise. |
| `SITE_NOINDEX` | No | `true` forces noindex robots/sitemap behavior. Auto-true on the `.dev` host. |

See `web/.env.local.example` for the local-development defaults. The full list of optional env vars is in [`env-and-config.md`](env-and-config.md).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (webpack, port 3001) |
| `npm run build` | Production build → `.next/standalone/` |
| `npm start` | Run the standalone server (port 3001) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript type check |
| `npm run test:unit` | Vitest unit suite (`--passWithNoTests`) |
| `npm run test:unit:watch` | Vitest watch mode |
| `npm run test:unit:coverage` | Vitest with v8 coverage |
| `npm run test:smoke` | Playwright `@smoke` tests |
| `npm run test:smoke:pr` | Build + run `@smoke` excluding `@live-upstream` (mirrors PR CI) |
| `npm test` | Full Playwright suite |
| `npm run test:headed` | Playwright with visible browser |
| `npm run test:ui` | Playwright UI mode |

## Docker (Local)

```bash
cd web
docker build -t scrolldown-web .
docker run -p 3001:3001 --env-file .env.local scrolldown-web
```

The Dockerfile inlines `NEXT_PUBLIC_*` build args from CI for the bundle. Locally those args are unset, which is fine — the app does not currently render any client-bundled `NEXT_PUBLIC_*` values besides `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

## How Data Flows

1. **Browser** calls a hook (e.g. `useGamesList`).
2. The hook hits a Next.js API route (e.g. `/api/games/recent`).
3. The route handler calls upstream via `apiFetch` / `cachedApiFetch` in `web/src/lib/api-server.ts`, which injects `X-API-Key`.
4. Response is cached in the BFF in-memory LRU (max 100 entries) per the route's fresh/stale windows.
5. The hook stores data in component state; `useCatchupProgress` and `useSettings` persist user-facing state to `localStorage`.

The `SPORTS_DATA_API_KEY` never reaches the browser. Client code only talks to local `/api/*` routes.

## Catch-up Pipeline (in dev)

`/dev/catchup-lab` (dev-only — 404 in production via `web/src/app/dev/layout.tsx`) runs captured fixtures in `web/tests/fixtures/games/` through the production `buildCatchupCards` + `planDeckWithReport` pipeline. The page lists all manifest entries, renders the resulting deck, and shows the planner's reasoning report side-by-side. Use it to validate selection / rhythm changes before they hit live games.

## Manual QA Checklist

### Home (`/`)

- [ ] Last-48h + today's MLB games render
- [ ] No score, win indicator, or final-state visible in any row (server strips them)
- [ ] Tapping a row opens `/catchup/[gameId]`
- [ ] `DegradedBanner` appears within ~30s if `/api/health` returns 503
- [ ] Theme toggle (system/light/dark) applies immediately

### Catchup viewer (`/catchup/[gameId]`)

- [ ] Scene-setter card shows venue + probable pitchers
- [ ] Cards advance via scroll/swipe (`CatchupScrollContainer`)
- [ ] `RhythmCard` half-inning summaries appear between play groups
- [ ] `CatchupCard` renders the field, runner paths, and trajectory
- [ ] Result chip / event personality matches the play type (`lib/result-chip.ts`)
- [ ] `FinalReveal` is locked until the user reaches the end (`RevealGate`)
- [ ] Tapping reveal shows final score + gameflow recap
- [ ] Refreshing returns to the user's last `cardIndex` (per `useCatchupProgress`)
- [ ] Live game polls every 45s with `?since=<lastSeenPlayIndex>`

### Onboarding

- [ ] First visit shows `TeamPickerOverlay` over the home feed
- [ ] Selecting an MLB team marks `onboarded: true` and stores the abbr
- [ ] "Skip" sets `onboarded: true` with `favoriteTeam: null`
- [ ] Reload does not re-show the gate

### Settings (`/settings`)

- [ ] Theme switcher persists
- [ ] "Show stale banners" toggle persists

### Dev tooling (`/dev/catchup-lab`)

- [ ] Lists every fixture from `tests/fixtures/games/_manifest.json`
- [ ] Selecting a fixture renders the deck and the planner report
- [ ] Returns 404 when `NODE_ENV === "production"`

### PWA

- [ ] Service worker registers on a non-localhost host
- [ ] Service worker is *un*registered on localhost / `*.local`
- [ ] `OfflineBanner` appears when the browser goes offline; auto-dismisses ~3s after reconnect
- [ ] `PWAInstallPrompt` appears after `PWA.INSTALL_MIN_SESSIONS` (2) sessions

## Common Issues

**API errors (502 from `/api/games/*`):**
- Confirm `SPORTS_DATA_API_KEY` is set in `.env.local`.
- Confirm upstream is reachable (`SPORTS_API_INTERNAL_URL` if you point at a non-default backend).
- The proxy maps upstream `401/403/5xx` to `502` so the browser doesn't blame itself — check the dev console / server logs for the original status.

**`/api/health` reports degraded but upstream is up:**
- Health pings `/api/admin/sports/games?limit=1` with a 15s timeout (`API.HEALTH_BACKEND_PING_TIMEOUT_MS`). A slow upstream can register as degraded even when it eventually succeeds.
- Playwright sets `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1` to bypass the upstream ping; if a stuck env var leaks into your dev shell, health will always return ok.

**Stale data after code changes:**
- `npm run dev` hot-reloads components, but route-handler / config changes need a full restart.
- Delete `.next/` for a clean build if caching seems stuck.

**Type errors:**
- `npx tsc --noEmit` covers everything. Shared API/domain types are in `web/src/lib/types.ts`.

**Service worker pollution on localhost:**
- The root layout's inline registration *unregisters* SW on localhost and clears caches. If you switched between localhost and a tunnel host, hard-refresh once.

**Catchup deck is empty / wrong on a live game:**
- Open `/api/games/[gameId]/cards?debug=true` to see the planner report and per-card audit.
- Replay the same gameId on `/dev/catchup-lab` against a captured fixture if there is one.

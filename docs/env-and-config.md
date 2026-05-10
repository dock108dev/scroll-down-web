# Environment Variables & Configuration

## Environment Variables

All variables read from the runtime env. None are required at build time except the Docker `ARG`s noted in [`deployment.md`](deployment.md#build-time-vs-runtime-env).

### Required

| Variable | Read in | Purpose |
|----------|---------|---------|
| `SPORTS_DATA_API_KEY` | `web/src/lib/api-server.ts:9` | Sent as `X-API-Key` to the upstream backend on every server-side fetch. Fallback chain: `SPORTS_DATA_API_KEY` → `SPORTS_API_KEY` → `API_KEY` → `""`. |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `SPORTS_API_INTERNAL_URL` | `https://sda.dock108.dev` (`BACKEND_BASE_URL`) | Override the backend URL. Use the Docker network DNS name when running both behind the same reverse proxy. |
| `SPORTS_GAMEFLOW_PATH` | `/api/admin/sports/games/{id}/gameflow` | Override the per-game recap path used by `/api/games/[gameId]/summary`. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `getSiteHost()` | Plausible `data-domain` injected on the loader script. |
| `PUBLIC_BASE_URL` | — | Canonical site origin used by SEO metadata, sitemap, and `publicBaseUrl()` in API routes that need to mint outbound URLs. |
| `SITE_URL` | — | Alias for `PUBLIC_BASE_URL`, read second by `getSiteUrl()`. |
| `MAGIC_LINK_BASE_URL` | — | Legacy alias accepted by `publicBaseUrl()` so existing deployments don't need to rename their env file when this repo migrated off magic-link auth. No magic-link code path consumes it today. |
| `SITE_NOINDEX` | auto (`true` on the `.dev` host, `false` otherwise) | `true` forces `noindex` in `robots.ts` / `sitemap.ts` and the root metadata. |
| `NODE_ENV` | (set by Next.js) | `production` makes `/dev/*` routes return 404 and is also the fallback gate in `getSiteUrl`. |
| `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER` | unset | Set to `1` by `playwright.config.ts` so `/api/health` skips upstream pings during E2E. |
| `NEXT_TELEMETRY_DISABLED` | `1` in Dockerfile + CI | Disable Next.js telemetry. |

### Currently-defined-but-unused (deployment plumbing only)

These are accepted by the Dockerfile / CI but **not consumed by application code in this repo**. They are leftover from a previous product direction and are documented only because someone reading the deployment yaml will see them. Removing them does not change runtime behavior.

| Variable | Where it appears | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_ADS_ENABLED` | Dockerfile `ARG`, ci.yml build-args | No reader in `web/src/`. |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Dockerfile, ci.yml | No reader. |
| `NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT` | Dockerfile, ci.yml | No reader. |
| `NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT` | Dockerfile, ci.yml | No reader. |
| `NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT` | Dockerfile, ci.yml | No reader. |
| `NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT` | Dockerfile, ci.yml | No reader. |
| `MAGIC_LINK_SECRET` | ci.yml (with hardcoded fallback) | No reader. The CI fallback exists so fork PRs without org secrets still build. |

## Centralized Config

All in-app tunables live in `web/src/lib/config.ts`. Only the constants currently exported from that file are listed here.

### Backend & league

| Constant | Value | Meaning |
|----------|-------|---------|
| `BACKEND_BASE_URL` | `"https://sda.dock108.dev"` | Default upstream host (overridable via `SPORTS_API_INTERNAL_URL`) |
| `LEAGUE` | `"mlb"` | The only league this app serves. Enforced at the proxy boundary. |

### `POLLING`

| Constant | Value | Meaning |
|----------|-------|---------|
| `POLLING.GAMES_REFRESH_MS` | 60_000 | Home feed refresh cadence when foregrounded |
| `POLLING.LIVE_CARDS_POLL_MS` | 45_000 | Per-game card poll cadence while the deck is open and game is live |

### `API`

| Constant | Value | Meaning |
|----------|-------|---------|
| `API.GAMES_LIMIT` | 200 | Max games per upstream request |
| `API.HEALTH_BACKEND_PING_TIMEOUT_MS` | 15_000 | Timeout for `/api/health` upstream ping |
| `API.HEALTH_CACHE_MS` | 30_000 | In-memory cache for `/api/health` result |
| `API.ISR_REVALIDATE_S` | 60 | Default `revalidate` for proxy routes that opt in |
| `API.BFF_CACHE_MAX_ENTRIES` | 100 | LRU cap for the in-memory BFF response cache |
| `API.GAMES_BFF_FRESH_MS` | 15_000 | Game list: serve cache without re-fetch under this age |
| `API.GAMES_BFF_STALE_MS` | 5 × 60_000 | Game list: serve stale on upstream 429/5xx within this window |
| `API.CARDS_LIVE_BFF_FRESH_MS` | 10_000 | Per-game cards (live): fresh window |
| `API.CARDS_LIVE_BFF_STALE_MS` | 3 × 60_000 | Per-game cards (live): stale-if-error window |
| `API.CARDS_FINAL_BFF_FRESH_MS` | 24h | Per-game cards (final): cache hard, content immutable |
| `API.CARDS_FINAL_BFF_STALE_MS` | 7d | Per-game cards (final): stale window |
| `API.SUMMARY_BFF_FRESH_MS` | 24h | Final-score summary: fresh window |
| `API.SUMMARY_BFF_STALE_MS` | 7d | Final-score summary: stale window |
| `API.HOME_WINDOW_MS` | 48h | How far back the home feed reaches |

### `LAYOUT`

| Constant | Value | Meaning |
|----------|-------|---------|
| `LAYOUT.HEADER_HEIGHT_DEFAULT` | `"56px"` | Top-nav height used by sticky offsets |

### `STORAGE_KEYS`

| Constant | Value |
|----------|-------|
| `STORAGE_KEYS.SETTINGS` | `"sd-settings"` |
| `STORAGE_KEYS.ONBOARDING` | `"sd-onboarding"` |
| `STORAGE_KEYS.CATCHUP_STATE` | `"sd-catchup-state"` |
| `STORAGE_KEYS.PWA_INSTALL_DISMISSED` | `"sd-pwa-install-dismissed"` |
| `STORAGE_KEYS.PWA_SESSION_COUNT` | `"sd-pwa-session-count"` |
| `STORAGE_KEYS.ANON_ID` | `"sd-anon-id"` |

### `PWA`

| Constant | Value | Meaning |
|----------|-------|---------|
| `PWA.INSTALL_MIN_SESSIONS` | 2 | Show install prompt after this many sessions |
| `PWA.OFFLINE_AUTO_DISMISS_MS` | 3_000 | Auto-dismiss the offline banner this long after reconnecting |

### `STORAGE`

| Constant | Value | Meaning |
|----------|-------|---------|
| `STORAGE.MAX_CATCHUP_ENTRIES` | 200 | Cap on per-game progress entries |
| `STORAGE.CATCHUP_MAX_AGE_DAYS` | 60 | Older entries are pruned on every write |

### `ATTRIBUTION`

| Constant | Value | Meaning |
|----------|-------|---------|
| `ATTRIBUTION.DATA_SOURCE_LABEL` | `"SportsDataAPI"` | Footer attribution label |

### `CATCHUP`

Deck sizing for `buildCatchupCards`. Tier 1 (scoring + late-game high-leverage) plays are always included; tier 2 is deterministically sampled per `gameId`.

| Constant | Value | Meaning |
|----------|-------|---------|
| `CATCHUP.TARGET_TOTAL` | 12 | Preferred deck size for an "ordinary" game |
| `CATCHUP.SOFT_MIN` | 5 | Floor for boring games (e.g. 1-0 duel) |
| `CATCHUP.HARD_MAX` | 18 | Ceiling that tier-2 sampling stops at; tier 1 can exceed |

Tuning bands documented in code: boring → 5-8, ordinary (5-3 / 6-4) → 8-14, wild (extras / comebacks) → 14-18.

### `BOX_SCORE`

Outbound box-score destination on the FinalReveal screen.

| Constant | Value | Meaning |
|----------|-------|---------|
| `BOX_SCORE.url(gameId)` | `https://www.mlb.com/gameday/${gameId}/final/box` | Full box score URL |
| `BOX_SCORE.label` | `"Full box score on MLB.com"` | Anchor label |

### `DEFAULTS`

| Constant | Value |
|----------|-------|
| `DEFAULTS.THEME` | `"system"` |
| `DEFAULTS.AWAY_ABBR_FALLBACK` | `"AWY"` |
| `DEFAULTS.HOME_ABBR_FALLBACK` | `"HME"` |

## Helpers exported alongside config

| Export | Purpose |
|--------|---------|
| `isPlaywrightServerEnv()` | Returns `true` when `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER === "1"`; used for CI-only branches (e.g. health route shortcut). |

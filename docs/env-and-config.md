# Environment Variables & Configuration

## Environment Variables

### Required

| Variable | Used By | Purpose |
|----------|---------|---------|
| `SPORTS_DATA_API_KEY` | `api-server.ts`, SSE route | API key sent as `X-API-Key` header to backend. Fallback chain: `SPORTS_DATA_API_KEY` > `SPORTS_API_KEY` > `API_KEY` > empty string. |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `SPORTS_API_INTERNAL_URL` | `https://sda.dock108.dev` | Server-side backend URL. Use this in Docker to hit the backend via internal network instead of public DNS. |

### Build-time

| Variable | Set By | Purpose |
|----------|--------|---------|
| `NEXT_TELEMETRY_DISABLED=1` | Dockerfile, CI | Disable Next.js telemetry |

## Centralized Config

All tunables live in `src/lib/config.ts`. No magic numbers elsewhere in the codebase.

### Cache TTLs

| Constant | Value | Meaning |
|----------|-------|---------|
| `CACHE.GAMES_TTL_MS` | 90s | Max age before games list is considered stale |
| `CACHE.GAMES_FRESH_MS` | 45s | Skip network entirely if cache is younger |
| `CACHE.GAME_DETAIL_TTL_MS` | 5 min | Per-game detail cache lifetime |
| `CACHE.FLOW_TTL_MS` | 5 min | Per-game flow narrative cache lifetime |
| `CACHE.FAIRBET_TTL_MS` | 3 min | FairBet odds cache lifetime |
| `CACHE.FAIRBET_FRESH_MS` | 90s | Show cached + silent background refresh if within this window |
| `CACHE.VISIBILITY_AWAY_MS` | 5s | Force refresh when tab hidden longer than this |

### Polling Intervals

| Constant | Value | Meaning |
|----------|-------|---------|
| `POLLING.GAMES_REFRESH_MS` | 60s | Background game list refresh interval |
| `POLLING.LIVE_GAME_POLL_MS` | 45s | Live game detail polling interval |
| `POLLING.LIVE_ODDS_REFRESH_MS` | 15s | Live FairBet odds polling interval |
| `POLLING.FOLLOWING_LIVE_TTL_MS` | 2 hours | Auto-disable Following Live after inactivity |
| `POLLING.FOLLOWING_LIVE_CHECK_MS` | 60s | How often to check for inactivity expiry |

### API Limits

| Constant | Value | Meaning |
|----------|-------|---------|
| `API.GAMES_LIMIT` | 200 | Max games per API request |
| `API.FAIRBET_PAGE_SIZE` | 100 | FairBet bets per page |
| `API.FAIRBET_MAX_CONCURRENT` | 3 | Max concurrent FairBet page fetches |

### Storage Bounds

| Constant | Value | Meaning |
|----------|-------|---------|
| `STORAGE.MAX_READING_POSITIONS` | 50 | Max saved scroll positions |
| `STORAGE.MAX_SECTION_LAYOUTS` | 50 | Max saved section expansion states |
| `STORAGE.MAX_REVEALED_IDS` | 500 | Max tracked revealed game IDs |
| `STORAGE.MAX_SNAPSHOTS` | 20 | Max score snapshots |
| `STORAGE.POSITION_MAX_AGE_DAYS` | 30 | Auto-prune reading positions older than this |
| `LAYOUT.MAX_PINNED_GAMES` | 10 | Max simultaneously pinned games |

### localStorage Keys

All keys are prefixed with `sd-` to avoid collisions.

| Key | Store | Contents |
|-----|-------|----------|
| `sd-auth` | `auth.ts` | JWT token, role, email, userId |
| `sd-settings` | `settings.ts` | Theme, score reveal mode, odds format, Following Live, etc. |
| `sd-pinned-games` | `pinned-games.ts` | Pinned game IDs + display metadata |
| `sd-read-state` | `reveal.ts` | Revealed game IDs + score snapshots |
| `sd-section-layout` | `section-layout.ts` | Expanded/collapsed sections per game |
| `sd-reading-position` | `reading-position.ts` | Scroll position per game (play index) |
| `sd-games-cache` | `stale-cache.ts` | Cached game data for degraded-state fallback |
| `sd-fairbet-cache` | `stale-cache.ts` | Cached FairBet odds for degraded-state fallback |
| `sd-golf-cache` | `stale-cache.ts` | Cached golf tournaments for degraded-state fallback |

Note: `home-scroll` store is in-memory only (not persisted to localStorage). Cache keys (`sd-*-cache`) are written by data-fetching hooks on successful fetch and read on cold start for stale fallback.

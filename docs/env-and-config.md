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
| `ANTHROPIC_API_KEY` | — | Required for AI story generation routes (`/api/ai/*`). Server-side only. |
| `STRIPE_SECRET_KEY` | — | Required for billing routes (`/api/billing/*`). Server-side only. |
| `STRIPE_WEBHOOK_SECRET` | — | Required to validate Stripe webhook payloads. |
| `MAGIC_LINK_SECRET` | — | Secret for signing magic-link tokens. |
| `DATABASE_URL` | — | Database connection string for magic-link auth (user accounts, sessions). |

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
| `POLLING.READING_RESUME_DELAY_MS` | 300ms | Delay before scrolling to saved reading position |
| `POLLING.FOLLOWING_LIVE_TTL_MS` | 2 hours | Auto-disable Following Live after inactivity |
| `POLLING.FOLLOWING_LIVE_CHECK_MS` | 60s | How often to check for inactivity expiry |
| `POLLING.TOKEN_REFRESH_MS` | 10 min | Silent JWT refresh cadence (legacy auth) |
| `POLLING.GOLF_LEADERBOARD_REFRESH_MS` | 60s | Golf leaderboard polling interval |
| `POLLING.GOLF_TOURNAMENTS_REFRESH_MS` | 5 min | Golf tournament list refresh interval |

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

Additional keys used by newer features:

| Key | Store / File | Contents |
|-----|-------------|----------|
| `sd-tier` | `tier.ts` | Free/pro tier + anonymous UUID |
| `sd-anon-id` | `tier.ts` (cookie) | Anonymous user UUID (also in cookie) |
| `sd-session` | `session.ts` (cookie) | HttpOnly session cookie (set by server) |
| `sd-onboarding-seen` | `localStorage` | Whether the reveal onboarding has been shown |
| `sd-pwa-install-dismissed` | `localStorage` | Whether the PWA install prompt was dismissed |
| `sd-pwa-session-count` | `localStorage` | Number of sessions (for install prompt threshold) |

Note: `home-scroll` store is in-memory only (not persisted to localStorage). Cache keys (`sd-*-cache`) are written by data-fetching hooks on successful fetch and read on cold start for stale fallback.

### API

| Constant | Value | Meaning |
|----------|-------|---------|
| `API.GAMES_LIMIT` | 200 | Max games per API request |
| `API.FAIRBET_PAGE_SIZE` | 100 | FairBet bets per page |
| `API.FAIRBET_MAX_CONCURRENT` | 3 | Max concurrent FairBet page fetches |
| `API.FAIRBET_REQUEST_TIMEOUT_MS` | 12_000 | Per-page FairBet request timeout |
| `API.FAIRBET_PAGE_RETRY_ATTEMPTS` | 2 | Retry attempts per FairBet page on transient failure |
| `API.FAIRBET_PAGE_RETRY_DELAY_MS` | 800 | Delay between FairBet page retries |
| `API.HEALTH_BACKEND_PING_TIMEOUT_MS` | 15_000 | `/api/health` upstream ping timeout (CI cold start headroom) |
| `API.ISR_REVALIDATE_S` | 60 | Next.js ISR revalidation for cached API proxy routes |

### Realtime

| Constant | Value | Meaning |
|----------|-------|---------|
| `REALTIME.WS_FAIL_THRESHOLD` | 2 | WebSocket failures before switching to SSE |
| `REALTIME.WS_FAIL_WINDOW_MS` | 60s | Window in which failures count toward the threshold |
| `REALTIME.SSE_FALLBACK_DURATION_MS` | 5 min | How long SSE runs before retrying WebSocket |
| `REALTIME.BACKOFF_INITIAL_MS` | 1s | Initial reconnect backoff |
| `REALTIME.BACKOFF_MAX_MS` | 30s | Max reconnect backoff (exponential) |
| `REALTIME.FRESHNESS_INDICATOR_MS` | 20s | Freshness threshold used by the realtime indicator UI |
| `REALTIME.RECOVERY_MIN_INTERVAL_MS` | 8s | Minimum gap between recovery re-fetches per channel |

### FairBet

| Constant | Value | Meaning |
|----------|-------|---------|
| `FAIRBET.MIN_BOOKS` | 3 | Hide bets with fewer than this many books posting a price |
| `FAIRBET.EV_HIGHLIGHT_THRESHOLD` | 5 | EV% at which a bet gets the strong-positive color |
| `FAIRBET.ATTRIBUTION_FRESH_MS` | 2 min | No staleness label if data is younger than this |
| `FAIRBET.ATTRIBUTION_STALE_MS` | 15 min | "May be delayed" amber label if older than this |
| `FAIRBET.ATTRIBUTION_UPDATE_INTERVAL_MS` | 30s | How often to re-evaluate the attribution label |
| `FAIRBET.CONFIDENCE_SAMPLE_HIGH` | 30 | Min `confidence` value for the high EV-confidence tier |
| `FAIRBET.CONFIDENCE_SAMPLE_MEDIUM` | 10 | Min `confidence` value for the medium EV-confidence tier |
| `FAIRBET.MONTE_CARLO_TRIALS` | 10_000 | Trials per Win Probability Monte Carlo run |

### Freshness Labels

| Constant | Value | Meaning |
|----------|-------|---------|
| `FRESHNESS.LABEL_MIN_MS` | 30s | No label shown if updated within this window |
| `FRESHNESS.AMBER_THRESHOLD_MS` | 2 min | Muted "Updated Xs ago" shown from 30s to 2 min |
| `FRESHNESS.RED_THRESHOLD_MS` | 5 min | Amber "May be delayed" from 2–5 min; red "Data delayed" above 5 min |
| `FRESHNESS.UPDATE_INTERVAL_MS` | 10s | Re-evaluate label every 10 seconds |

### Render

| Constant | Value | Meaning |
|----------|-------|---------|
| `RENDER.FAIRBET_BATCH` | 25 | Number of FairBet cards to render per batch (virtual list chunking) |

### Validation

| Constant | Value | Meaning |
|----------|-------|---------|
| `isValidEmailFormat()` | `(email: string) => boolean` | Email format guard (replaces the old `VALIDATION.EMAIL_RE` regex): linear-time, no ReDoS; requires exactly one `@`, non-empty local part ≤64 chars, domain with at least one `.` with non-empty sides, no whitespace/`@` in local or domain, total length ≤254. |
| `VALIDATION.PASSWORD_MIN_LENGTH` | 8 | Minimum password length |

### Attribution

| Constant | Value | Meaning |
|----------|-------|---------|
| `ATTRIBUTION.DATA_SOURCE_LABEL` | `"SportsDataAPI"` | Label shown in game detail footer: "Game data provided by SportsDataAPI" |

### AI Story

| Constant | Value | Meaning |
|----------|-------|---------|
| `AI_STORY.BANNED_PHRASES` | `[...]` | Generic filler phrases that cause a story to be rejected |
| `AI_STORY.MAX_SENTENCES` | 6 | Total sentence budget per story |
| `AI_STORY.MAX_SENTENCES_PER_SECTION` | 2 | Sentence cap per narrative section |
| `AI_STORY.MAX_WORDS` | 150 | Word cap per story |
| `AI_STORY.MODEL` | `"claude-haiku-4-5-20251001"` | Anthropic model used for story generation |
| `STORY_QUALITY_GATE` | `true` | When `true`, hides the AI story section for all games. Set to `false` after passing the 50-story review bar. |

### Feature Gates

Canonical Pro-tier gate keys. All server routes and client hooks that enforce a paywall must reference one of these via `lib/pro-gate.ts` or `hooks/useProGate.ts` — never use string literals for gate checks.

| Constant | Value | Meaning |
|----------|-------|---------|
| `FEATURE_GATES.LIVE_ODDS` | `"live_odds"` | Real-time in-game odds |
| `FEATURE_GATES.FULL_FAIRBET` | `"full_fairbet"` | Full FairBet access with all markets |
| `FEATURE_GATES.ALL_BOOKS` | `"all_books"` | All sportsbooks in comparisons |
| `FEATURE_GATES.ALL_MARKETS` | `"all_markets"` | Alt lines and prop markets |
| `FEATURE_GATES.CROSS_DEVICE_SYNC` | `"cross_device_sync"` | Sync across devices |
| `FEATURE_GATES.ADVANCED_FILTERS` | `"advanced_filters"` | Advanced FairBet filter controls |
| `FEATURE_GATES.LINE_MOVEMENT` | `"line_movement"` | Line-movement history |
| `FEATURE_GATES.EV_SIMULATOR` | `"ev_simulator"` | Custom EV / simulation tools |
| `FEATURE_GATES.CLV_TRACKING` | `"clv_tracking"` | Closing-line-value tracking |
| `FEATURE_GATES.WIN_PROBABILITY` | `"win_probability"` | Win-probability sheet (uses `FAIRBET.MONTE_CARLO_TRIALS`) |
| `FEATURE_GATES.HISTORY` | `"history"` | Historical games archive |

### Auth

| Constant | Value | Meaning |
|----------|-------|---------|
| `AUTH.MAGIC_TOKEN_TTL_MS` | 15 min | Magic-link token expires after this duration |
| `AUTH.SESSION_TTL_S` | 30 days | Session cookie lifetime |
| `AUTH.SEND_LINK_RATE_MAX` | 5 | Max magic-link sends per IP per window |
| `AUTH.SEND_LINK_RATE_WINDOW_MS` | 10 min | Rate-limit window for magic-link sends |

### Ads

| Constant | Value | Meaning |
|----------|-------|---------|
| `ADS.TOP_FEED_AFTER_INDEX` | 2 | Render the home `top-feed` `FeedAd` after this game-row index in the Today section |
| `ADS.MID_FEED_AFTER_INDEX` | 6 | Render the home `mid-feed` `FeedAd` after this game-row index in the Today section |

AdSense slot IDs and the kill switch live in env vars (read in
`web/src/lib/ads/config.ts`), not in `web/src/lib/config.ts`. See
[ADS_SETUP.md](ADS_SETUP.md) for the env-var matrix.

### Defaults

| Constant | Value | Meaning |
|----------|-------|---------|
| `DEFAULTS.HOME_EXPANDED` | `[]` | Date sections expanded by default on home page |
| `DEFAULTS.TIMELINE_TIERS` | `[1, 2, 3]` | Play importance tiers shown in timeline by default |
| `DEFAULTS.ODDS_FORMAT` | `"american"` | Default odds format |
| `DEFAULTS.THEME` | `"system"` | Default color theme |
| `DEFAULTS.AWAY_ABBR_FALLBACK` | `"AWY"` | Fallback abbreviation when away team is unknown |
| `DEFAULTS.HOME_ABBR_FALLBACK` | `"HME"` | Fallback abbreviation when home team is unknown |

### Headline Stats

Sport-specific collapsed stat labels shown per player row before expansion. Keys match `leagueCode.toLowerCase()` or typed table variants (`nhl_skater`, `nhl_goalie`, `mlb_batter`, `mlb_pitcher`).

| Key | Labels |
|-----|--------|
| `nba` / `ncaab` | PTS, REB, AST |
| `nfl` / `ncaaf` | YDS, TD |
| `nhl_skater` | G, A, PTS |
| `nhl_goalie` | SV, GA, SV% |
| `mlb_batter` | H, RBI, AVG |
| `mlb_pitcher` | IP, K, ERA |

### PWA

| Constant | Value | Meaning |
|----------|-------|---------|
| `PWA.INSTALL_MIN_SESSIONS` | 2 | Show install prompt after this many sessions |
| `PWA.OFFLINE_AUTO_DISMISS_MS` | 3s | Auto-dismiss the offline banner this long after reconnecting |

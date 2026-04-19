/**
 * Centralized app constants. All tunables (cache TTLs, polling intervals,
 * pagination sizes, storage keys, UI defaults) live here so they can be
 * adjusted from a single file.
 */

export const BACKEND_BASE_URL = "https://sda.dock108.dev";

export const CACHE = {
  GAMES_TTL_MS: 90_000,
  GAMES_FRESH_MS: 45_000, // skip network if cache is younger than this
  GAMES_MAX_ENTRIES: 5,
  GAME_DETAIL_TTL_MS: 5 * 60_000,
  GAME_DETAIL_MAX_ENTRIES: 8,
  FLOW_TTL_MS: 5 * 60_000,
  FLOW_MAX_ENTRIES: 8,
  FAIRBET_TTL_MS: 3 * 60_000,
  FAIRBET_FRESH_MS: 90_000,
  VISIBILITY_AWAY_MS: 5_000, // force refresh when tab hidden longer than this
};

export const POLLING = {
  GAMES_REFRESH_MS: 60_000,
  LIVE_GAME_POLL_MS: 45_000,
  LIVE_ODDS_REFRESH_MS: 15_000,
  READING_RESUME_DELAY_MS: 300, // wait for DOM render before scrolling to saved position
  FOLLOWING_LIVE_TTL_MS: 120 * 60_000, // 2 hours of inactivity before auto-disabling
  FOLLOWING_LIVE_CHECK_MS: 60_000, // how often to check for inactivity expiry
  TOKEN_REFRESH_MS: 10 * 60_000, // silently refresh JWT every 10 min
  GOLF_LEADERBOARD_REFRESH_MS: 60_000,
  GOLF_TOURNAMENTS_REFRESH_MS: 5 * 60_000,
};

export const API = {
  GAMES_LIMIT: 200,
  FAIRBET_PAGE_SIZE: 100,
  FAIRBET_MAX_CONCURRENT: 3,
  /** `/api/health` upstream ping — generous for CI cold start + parallel E2E load */
  HEALTH_BACKEND_PING_TIMEOUT_MS: 15_000,
  FAIRBET_REQUEST_TIMEOUT_MS: 12_000,
  FAIRBET_PAGE_RETRY_ATTEMPTS: 2,
  FAIRBET_PAGE_RETRY_DELAY_MS: 800,
  ISR_REVALIDATE_S: 60, // Next.js ISR revalidation for API proxy routes
};

export const FAIRBET = {
  MIN_BOOKS: 3, // hide bets with fewer books posting a price
  EV_HIGHLIGHT_THRESHOLD: 5, // EV% at which a bet gets the strong-positive color
  EV_TIER_STRONG: 7,    // > $7 per $100 → dark green
  EV_TIER_GOOD: 3,      // $3–$7 per $100 → light green
  EV_TIER_MARGINAL: 1,  // $1–$3 per $100 → amber
  // < $1 per $100 → no-edge (gray, no highlight)
  ATTRIBUTION_FRESH_MS: 2 * 60_000,         // < 2m: no staleness label
  ATTRIBUTION_STALE_MS: 15 * 60_000,        // > 15m: amber "May be delayed"
  ATTRIBUTION_UPDATE_INTERVAL_MS: 30_000,   // re-evaluate attribution label every 30s
  // Minimum `confidence` value (proxy for sample size) for each EV confidence tier
  CONFIDENCE_SAMPLE_HIGH: 30,
  CONFIDENCE_SAMPLE_MEDIUM: 10,
  MONTE_CARLO_TRIALS: 10_000,               // simulation iterations for Win Probability sheet
};

export const REALTIME = {
  WS_FAIL_THRESHOLD: 2,
  WS_FAIL_WINDOW_MS: 60_000,
  SSE_FALLBACK_DURATION_MS: 5 * 60_000,
  BACKOFF_INITIAL_MS: 1_000,
  BACKOFF_MAX_MS: 30_000,
  FRESHNESS_INDICATOR_MS: 20_000,
  RECOVERY_MIN_INTERVAL_MS: 8_000,
};

export const LAYOUT = {
  HEADER_HEIGHT_WITH_PINS: "88px", // nav + pinned bar
  HEADER_HEIGHT_DEFAULT: "56px", // nav only
  MAX_PINNED_GAMES: 10,
};

export const STORAGE_KEYS = {
  PINNED_GAMES: "sd-pinned-games",
  READ_STATE: "sd-read-state",
  SETTINGS: "sd-settings",
  SECTION_LAYOUT: "sd-section-layout",
  READING_POSITION: "sd-reading-position",
  AUTH: "sd-auth",
  GAMES_CACHE: "sd-games-cache",
  FAIRBET_CACHE: "sd-fairbet-cache",
  GOLF_CACHE: "sd-golf-cache",
  ONBOARDING_SEEN: "sd-onboarding-seen",
  PWA_INSTALL_DISMISSED: "sd-pwa-install-dismissed",
  PWA_SESSION_COUNT: "sd-pwa-session-count",
  TIER: "sd-tier",
  ANON_ID: "sd-anon-id",
  SESSION: "sd-session",
  MY_BETS: "sd-my-bets",
  FAIRBET_FILTERS: "sd-fairbet-filters",
};

export const PWA = {
  /** Show install prompt after this many sessions. */
  INSTALL_MIN_SESSIONS: 2,
  /** Auto-dismiss offline banner this many ms after reconnection. */
  OFFLINE_AUTO_DISMISS_MS: 3_000,
};

export const STORAGE = {
  MAX_READING_POSITIONS: 50,
  MAX_SECTION_LAYOUTS: 50,
  MAX_REVEALED_IDS: 500,
  MAX_SNAPSHOTS: 20,
  POSITION_MAX_AGE_DAYS: 30,
  LAYOUT_MAX_AGE_DAYS: 30,
  MAX_MY_BETS: 200,
};

export const FRESHNESS = {
  LABEL_MIN_MS: 30_000,           // <30s: no label
  AMBER_THRESHOLD_MS: 2 * 60_000, // 30s–2min: "Updated Xs ago" (muted)
  RED_THRESHOLD_MS: 5 * 60_000,   // 2–5min: "May be delayed" (amber), >5min: "Data delayed" (red)
  UPDATE_INTERVAL_MS: 10_000,     // re-evaluate label every 10s
};

export const RENDER = {
  FAIRBET_BATCH: 25,
};

export const VALIDATION = {
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
};

export const ATTRIBUTION = {
  /** Displayed in the game detail page footer: "Game data provided by <LABEL>" */
  DATA_SOURCE_LABEL: "SportsDataAPI",
};

export const AI_STORY = {
  BANNED_PHRASES: [
    "both teams fought hard",
    "thrilling contest",
    "back and forth",
    "hard fought",
  ] as readonly string[],
  MAX_SENTENCES: 6,
  MAX_SENTENCES_PER_SECTION: 2,
  MAX_WORDS: 150,
  MODEL: "claude-haiku-4-5-20251001",
};

/**
 * When true, the AI game story section is hidden for all games.
 * Default is true until 50+ stories are reviewed and filler/inaccuracy rate is confirmed <20%.
 */
export const STORY_QUALITY_GATE = true;

/**
 * Canonical list of Pro-gated feature keys. Every server route and client hook
 * that enforces a paywall must reference one of these keys so the gate surface
 * stays in sync. All values below require a Pro subscription.
 */
export const FEATURE_GATES = {
  LIVE_ODDS: "live_odds",
  FULL_FAIRBET: "full_fairbet",
  ALL_BOOKS: "all_books",
  ALL_MARKETS: "all_markets",
  CROSS_DEVICE_SYNC: "cross_device_sync",
  ADVANCED_FILTERS: "advanced_filters",
  LINE_MOVEMENT: "line_movement",
  EV_SIMULATOR: "ev_simulator",
  CLV_TRACKING: "clv_tracking",
  WIN_PROBABILITY: "win_probability",
  HISTORY: "history",
} as const;

export type FeatureGateKey = (typeof FEATURE_GATES)[keyof typeof FEATURE_GATES];

export const AUTH = {
  /** Magic-link token lifetime */
  MAGIC_TOKEN_TTL_MS: 15 * 60_000,
  /** Session cookie + JWT lifetime */
  SESSION_TTL_S: 30 * 24 * 60 * 60,
  /** Max magic-link requests per IP per window */
  SEND_LINK_RATE_MAX: 5,
  SEND_LINK_RATE_WINDOW_MS: 10 * 60_000,
};

export const ADS = {
  NATIVE_AD_INTERVAL: 8,
  BANNER_WIDTH: 320,
  BANNER_HEIGHT: 50,
};

export const DEFAULTS = {
  HOME_EXPANDED: [] as string[],
  TIMELINE_TIERS: [1, 2, 3] as number[],
  ODDS_FORMAT: "american",
  THEME: "system",
  AWAY_ABBR_FALLBACK: "AWY",
  HOME_ABBR_FALLBACK: "HME",
};

/** Headline stat labels to show collapsed per sport/position type.
 *  Keys match leagueCode.toLowerCase() for generic stats, or
 *  "nhl_skater" / "nhl_goalie" / "mlb_batter" / "mlb_pitcher" for typed tables.
 *  Labels must match the `label` field of the relevant column definition. */
export const HEADLINE_STATS: Record<string, readonly string[]> = {
  nba:         ["PTS", "REB", "AST"],
  ncaab:       ["PTS", "REB", "AST"],
  nfl:         ["YDS", "TD"],
  ncaaf:       ["YDS", "TD"],
  nhl_skater:  ["G", "A", "PTS"],
  nhl_goalie:  ["SV", "GA", "SV%"],
  mlb_batter:  ["H", "RBI", "AVG"],
  mlb_pitcher: ["IP", "K", "ERA"],
};

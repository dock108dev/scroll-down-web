/**
 * Centralized app constants. All tunables (cache TTLs, polling intervals,
 * pagination sizes, storage keys, UI defaults) live here so they can be
 * adjusted from a single file.
 */

export const BACKEND_BASE_URL = "https://sda.dock108.dev";

/** The only league this app serves. Forced server-side at the proxy boundary. */
export const LEAGUE = "mlb";

/** Playwright `webServer` sets this — use for CI-only behavior (rate limits, etc.). */
export function isPlaywrightServerEnv(): boolean {
  return process.env.SCROLLDOWN_PLAYWRIGHT_WEB_SERVER === "1";
}

export const POLLING = {
  /** Home feed refresh cadence when tab is foregrounded. */
  GAMES_REFRESH_MS: 60_000,
  /** Per-game card poll cadence while the deck is open and game is live. */
  LIVE_CARDS_POLL_MS: 45_000,
};

export const API = {
  GAMES_LIMIT: 200,
  HEALTH_BACKEND_PING_TIMEOUT_MS: 15_000,
  HEALTH_CACHE_MS: 30_000,
  ISR_REVALIDATE_S: 60,
  BFF_CACHE_MAX_ENTRIES: 100,
  /** Game list (live + recent finals): re-fetch quickly. */
  GAMES_BFF_FRESH_MS: 15_000,
  GAMES_BFF_STALE_MS: 5 * 60_000,
  /** Per-game cards while the game is live: short cache. */
  CARDS_LIVE_BFF_FRESH_MS: 10_000,
  CARDS_LIVE_BFF_STALE_MS: 3 * 60_000,
  /** Per-game cards once the game is final: cache hard, content is immutable. */
  CARDS_FINAL_BFF_FRESH_MS: 24 * 60 * 60_000,
  CARDS_FINAL_BFF_STALE_MS: 7 * 24 * 60 * 60_000,
  /** Summary endpoint: only meaningful for finals; cache hard. */
  SUMMARY_BFF_FRESH_MS: 24 * 60 * 60_000,
  SUMMARY_BFF_STALE_MS: 7 * 24 * 60 * 60_000,
  /** How far back the home feed reaches. */
  HOME_WINDOW_MS: 48 * 60 * 60 * 1_000,
};

export const LAYOUT = {
  HEADER_HEIGHT_DEFAULT: "56px",
};

export const STORAGE_KEYS = {
  SETTINGS: "sd-settings",
  /** First-visit + favorite team. */
  ONBOARDING: "sd-onboarding",
  /** Per-game catch-up state (progress index, completed flag). */
  CATCHUP_STATE: "sd-catchup-state",
  PWA_INSTALL_DISMISSED: "sd-pwa-install-dismissed",
  PWA_SESSION_COUNT: "sd-pwa-session-count",
  ANON_ID: "sd-anon-id",
};

export const PWA = {
  INSTALL_MIN_SESSIONS: 2,
  OFFLINE_AUTO_DISMISS_MS: 3_000,
};

export const STORAGE = {
  /** Cap on how many per-game progress entries we keep before evicting oldest. */
  MAX_CATCHUP_ENTRIES: 200,
  /** Stored progress entries older than this are pruned. */
  CATCHUP_MAX_AGE_DAYS: 60,
};

export const ATTRIBUTION = {
  DATA_SOURCE_LABEL: "SportsDataAPI",
};

/**
 * Catch-up deck sizing. Tier 1 (scoring + late-game high-leverage) plays are
 * ALWAYS included. Tier 2 plays are deterministically sampled per gameId to
 * keep the deck around the target without truncating real key plays.
 *
 * Target lives in the middle of the soft window. Sampling stops once tier 1 +
 * sampled tier 2 reaches HARD_MAX. We never trim tier 1 even if it exceeds
 * HARD_MAX — those are the moments the user actually came for.
 */
export const CATCHUP = {
  /** Preferred total for an "ordinary" game (5-3 / 6-4 typical shape).
   *  Wild games push toward HARD_MAX; boring games stay near SOFT_MIN.
   *  Tuned against the user's deck-shape acceptance bands:
   *    boring (1-0 duel)         → 5-8 play cards
   *    ordinary (5-3 / 6-4)      → 8-14 play cards
   *    wild (extras / comebacks) → 14-18 play cards
   */
  TARGET_TOTAL: 12,
  SOFT_MIN: 5,
  HARD_MAX: 18,
};

/** Outbound box-score destination. Per product decision: MLB.com. */
export const BOX_SCORE = {
  /** Function is provided so we can swap providers without a code-wide search. */
  url: (gameId: number) => `https://www.mlb.com/gameday/${gameId}/final/box`,
  label: "Full box score on MLB.com",
};

export const DEFAULTS = {
  THEME: "system",
  AWAY_ABBR_FALLBACK: "AWY",
  HOME_ABBR_FALLBACK: "HME",
};

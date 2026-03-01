/**
 * Centralized app constants. All tunables (cache TTLs, polling intervals,
 * pagination sizes, storage keys, UI defaults) live here so they can be
 * adjusted from a single file.
 */

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
};

export const POLLING = {
  GAMES_REFRESH_MS: 60_000,
  LIVE_GAME_POLL_MS: 45_000,
  READING_RESUME_DELAY_MS: 300, // wait for DOM render before scrolling to saved position
};

export const API = {
  GAMES_LIMIT: 200,
  FAIRBET_PAGE_SIZE: 100,
  FAIRBET_MAX_CONCURRENT: 3,
  ISR_REVALIDATE_S: 60, // Next.js ISR revalidation for API proxy routes
};

export const FAIRBET = {
  MIN_BOOKS: 3, // hide bets with fewer books posting a price
  EV_HIGHLIGHT_THRESHOLD: 5, // EV% at which a bet gets the strong-positive color
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
};

export const DEFAULTS = {
  HOME_EXPANDED: ["Today", "Yesterday"],
  TIMELINE_TIERS: [1, 2, 3] as number[],
  ODDS_FORMAT: "american",
  THEME: "system",
  AWAY_ABBR_FALLBACK: "AWY",
  HOME_ABBR_FALLBACK: "HME",
};

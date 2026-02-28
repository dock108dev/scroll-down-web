export const CACHE = {
  GAMES_TTL_MS: 90_000,
  GAMES_FRESH_MS: 45_000,
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
  READING_RESUME_DELAY_MS: 300,
};

export const API = {
  GAMES_LIMIT: 200,
  FAIRBET_PAGE_SIZE: 100,
  FAIRBET_MAX_CONCURRENT: 3,
  ISR_REVALIDATE_S: 60,
};

export const FAIRBET = {
  MIN_BOOKS: 3,
  EV_HIGHLIGHT_THRESHOLD: 5,
};

export const LAYOUT = {
  HEADER_HEIGHT_WITH_PINS: "88px",
  HEADER_HEIGHT_DEFAULT: "56px",
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

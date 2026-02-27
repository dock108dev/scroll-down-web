export const LEAGUE_OPTIONS = [
  { code: "nba", label: "NBA" },
  { code: "ncaab", label: "NCAAB" },
  { code: "nfl", label: "NFL" },
  { code: "ncaaf", label: "NCAAF" },
  { code: "mlb", label: "MLB" },
  { code: "nhl", label: "NHL" },
] as const;

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1280,
} as const;

export const MAX_CONTENT_WIDTH = {
  mobile: "100%",
  tablet: "900px",
  desktop: "1200px",
} as const;

// ── FairBetTheme ────────────────────────────────────────────────────
export const FairBetTheme = {
  /** Success / positive value - bright green (high EV 5%+) */
  positive: "rgb(46, 184, 115)", // 0.18, 0.72, 0.45
  /** Muted positive (0-5% EV) */
  positiveMuted: "rgb(89, 166, 128)", // 0.35, 0.65, 0.50
  /** Soft success background */
  successSoft: "rgba(46, 184, 115, 0.12)",
  /** Muted success background */
  successSoftMuted: "rgba(89, 166, 128, 0.10)",
  /** Error / negative / warning - softer coral */
  negative: "rgb(209, 107, 102)", // 0.82, 0.42, 0.40
  /** Neutral / even / fair value */
  neutral: "rgb(140, 145, 158)", // 0.55, 0.57, 0.62
  /** Informational accent */
  info: "rgb(89, 140, 242)", // 0.35, 0.55, 0.95
  /** Soft info background */
  infoSoft: "rgba(89, 140, 242, 0.10)",
  /** Primary card background (dark) */
  cardBackground: "rgb(36, 41, 51)", // 0.14, 0.16, 0.20
  /** Secondary surface */
  surfaceTint: "rgb(26, 31, 41)", // 0.10, 0.12, 0.16
  /** Tertiary surface for nested elements */
  surfaceSecondary: "rgb(46, 51, 64)", // 0.18, 0.20, 0.25
  /** Subtle border */
  cardBorder: "rgba(255, 255, 255, 0.08)",
  /** Slightly more visible border */
  borderSubtle: "rgba(255, 255, 255, 0.12)",
} as const;

// ── Book abbreviations ──────────────────────────────────────────────
const BOOK_ABBREVIATION_MAP: Record<string, string> = {
  draftkings: "DK",
  fanduel: "FD",
  betmgm: "MGM",
  caesars: "CZR",
  espnbet: "ESPN",
  fanatics: "FAN",
  "hard rock bet": "HR",
  pinnacle: "PIN",
  bet365: "365",
  betrivers: "BR",
  "william hill": "WH",
  "888sport": "888",
  pointsbet: "PB",
  wynnbet: "WYNN",
  bovada: "BOV",
};

/**
 * Abbreviate a sportsbook name to a short display label.
 * Matches names case-insensitively; falls back to the first 3 characters
 * uppercased.
 */
export function bookAbbreviation(name: string): string {
  const key = name.toLowerCase().trim();
  return BOOK_ABBREVIATION_MAP[key] ?? key.slice(0, 3).toUpperCase();
}

/**
 * Design tokens matching the iOS DesignSystem / GameTheme / FairBetTheme enums.
 *
 * All numeric values are in `px` unless noted otherwise.
 * Color values use the same RGB ratios as Swift so the two platforms look identical.
 */

// ── Corner Radii ────────────────────────────────────────────────────
export const Radius = {
  /** Large cards, section cards, main containers */
  card: 10,
  /** Medium elements: timeline rows, stat rows, nested cards */
  element: 8,
  /** Small elements: chips, tags, tooltips */
  small: 5,
} as const;

// ── Spacing ─────────────────────────────────────────────────────────
export const Spacing = {
  /** Between major sections */
  section: 14,
  /** Between cards / rows in a list */
  list: 6,
  /** Internal card padding */
  cardPadding: 12,
  /** Internal element padding */
  elementPadding: 10,
  /** Between text elements */
  text: 3,
  /** Tight spacing */
  tight: 2,
} as const;

// ── Shadows ─────────────────────────────────────────────────────────
export const Shadow = {
  /** Colour expressed as CSS rgba */
  color: "rgba(0, 0, 0, 0.06)",
  /** Dark mode colour */
  colorDark: "rgba(0, 0, 0, 0.25)",
  radius: 4,
  y: 1,
  /** Subtle shadow for nested elements */
  subtleRadius: 3,
  subtleY: 1,
  /** Full card shadow */
  cardRadius: 8,
  cardY: 2,
  /** Elevated interactive shadow */
  elevatedRadius: 12,
  elevatedY: 4,
} as const;

// ── Typography (CSS values mapping iOS TextStyle hierarchy) ─────────
export const Typography = {
  /** Narrative / body copy */
  narrative: {
    fontSize: "0.9375rem", // 15px
    lineHeight: "1.5",
    fontWeight: "400",
  },
  /** Section headers */
  sectionHeader: {
    fontSize: "0.8125rem", // 13px ~ .subheadline
    lineHeight: "1.4",
    fontWeight: "600",
  },
  /** Labels / row titles */
  label: {
    fontSize: "0.8125rem", // 13px ~ .footnote
    lineHeight: "1.4",
    fontWeight: "400",
  },
  /** Metadata / captions */
  metadata: {
    fontSize: "0.6875rem", // 11px ~ .caption2
    lineHeight: "1.35",
    fontWeight: "400",
  },
  /** Score values */
  score: {
    fontSize: "0.75rem", // 12px ~ .caption
    lineHeight: "1.35",
    fontWeight: "500",
    fontVariantNumeric: "tabular-nums",
  },
  /** Stat labels */
  statLabel: {
    fontSize: "0.6875rem",
    lineHeight: "1.35",
    fontWeight: "600",
  },
} as const;

// ── Text Colors ─────────────────────────────────────────────────────
export const TextColor = {
  /** Primary text (white in dark mode) */
  primary: "rgba(255, 255, 255, 1)",
  /** Secondary: labels, metadata */
  secondary: "rgba(255, 255, 255, 0.7)",
  /** Tertiary: hints, placeholders */
  tertiary: "rgba(255, 255, 255, 0.5)",
  /** Score highlight in dark mode (vibrant red) */
  scoreHighlight: "rgb(255, 85, 85)",
} as const;

// ── GameTheme ───────────────────────────────────────────────────────
export const GameTheme = {
  /** Primary accent - confident blue */
  accentColor: "rgb(80, 140, 220)",
  /** Card background (dark mode: secondarySystemBackground equivalent) */
  cardBackground: "rgb(28, 28, 30)",
  /** Card border */
  cardBorder: "rgba(255, 255, 255, 0.08)",
  /** Card corner radius */
  cardCornerRadius: 12,
  /** Card shadow */
  cardShadow: "rgba(0, 0, 0, 0.25)",
  cardShadowRadius: 8,
  cardShadowY: 2,
  /** Elevated shadow for interactive elements */
  elevatedShadow: "rgba(0, 0, 0, 0.35)",
  elevatedShadowRadius: 12,
  elevatedShadowY: 4,
  /** Background */
  background: "rgb(0, 0, 0)",
} as const;

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

// ── Border defaults ────────────────────────────────────────────────
export const Border = {
  color: "rgba(255, 255, 255, 0.08)",
  width: 0.5,
} as const;

// ── Accent defaults ────────────────────────────────────────────────
export const Accent = {
  primary: "rgb(0, 122, 255)", // systemBlue equivalent
  background: "rgba(0, 122, 255, 0.12)",
} as const;

// ── Default team colors (fallbacks) ────────────────────────────────
export const DefaultTeamColors = {
  teamA: "rgb(160, 130, 255)", // brighter purple (dark mode)
  teamABackground: "rgba(160, 130, 255, 0.15)",
  teamABar: "rgba(160, 130, 255, 0.8)",
  teamB: "rgb(100, 200, 180)", // softer teal (dark mode)
  teamBBackground: "rgba(100, 200, 180, 0.15)",
  teamBBar: "rgba(100, 200, 180, 0.8)",
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Convert a hex color string (#RRGGBB or #RGB) to {r,g,b} normalised 0-1 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "");
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
    g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
    b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16) / 255;
    g = parseInt(cleaned.slice(2, 4), 16) / 255;
    b = parseInt(cleaned.slice(4, 6), 16) / 255;
  } else {
    return null;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/**
 * Normalised Euclidean distance between two hex colours (0-1).
 * Mirrors the iOS `colorDistance` in DesignSystem.TeamColorProvider.
 */
export function colorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1; // treat invalid as "very different"
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 1.732;
}

/** Clash detection threshold (same as iOS) */
const CLASH_THRESHOLD = 0.12;

/**
 * Resolve a matchup-safe colour for a team shown beside an opponent.
 *
 * `isHome` = true means "this team yields to neutral on clash" (home team).
 * The away team always keeps its original colour.
 *
 * Returns the provided `teamColor` hex string, or a neutral fallback ("white")
 * when the two colours are too similar.
 */
export function matchupColor(
  teamColor: string,
  opponentColor: string,
  isHome: boolean,
): string {
  if (!isHome) return teamColor;
  if (colorDistance(teamColor, opponentColor) < CLASH_THRESHOLD) {
    return "#ffffff";
  }
  return teamColor;
}

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
  // legacy entries kept from constants.ts
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

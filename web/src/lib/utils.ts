import type { OddsFormat } from "./types";

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatOdds(price: number, format: OddsFormat): string {
  switch (format) {
    case "american":
      return price > 0 ? `+${price}` : `${price}`;
    case "decimal": {
      const decimal =
        price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
      return decimal.toFixed(2);
    }
    case "fractional": {
      const decimal =
        price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
      const frac = decimal - 1;
      const numerator = Math.round(frac * 100);
      const denominator = 100;
      const gcd = greatestCommonDivisor(numerator, denominator);
      return `${numerator / gcd}/${denominator / gcd}`;
    }
  }
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Team color helpers ───────────────────────────────────

function isDarkMode(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

/**
 * Pick the correct team color for the current theme.
 * Falls back to `fallback` if no color is available.
 */
export function resolveTeamColor(
  colorLight: string | undefined,
  colorDark: string | undefined,
  fallback = "#888",
): string {
  const dark = isDarkMode();
  const color = dark ? colorDark : colorLight;
  return color || fallback;
}

/**
 * Returns inline style for team-colored text with a contrast outline.
 * Uses a CSS variable so the outline adapts to light/dark mode automatically.
 */
export function teamColorStyle(
  colorLight: string | undefined,
  colorDark: string | undefined,
  fallback = "#888",
): React.CSSProperties {
  const color = resolveTeamColor(colorLight, colorDark, fallback);
  return {
    color,
    textShadow: "var(--ds-team-text-outline)",
  };
}

// ─── Card display name helpers ─────────────────────────

const COLLEGE_LEAGUES = new Set(["ncaab", "ncaaf"]);

/** Multi-word pro nicknames (lowercase). */
const PRO_MULTI_WORD: string[] = [
  "trail blazers",
  "blue jackets",
  "red wings",
  "maple leafs",
  "blue jays",
  "red sox",
  "white sox",
  "golden knights",
];

/** Multi-word college mascots (lowercase) — explicit overrides. */
const COLLEGE_MULTI_WORD: string[] = [
  "tar heels",
  "crimson tide",
  "yellow jackets",
  "horned frogs",
  "nittany lions",
  "fighting irish",
  "fighting illini",
  "orange men",
  "flying dutchmen",
];

/**
 * Common first-words of two-word college mascots (lowercase).
 * When the second-to-last word of a full team name matches one of these,
 * we assume the mascot is two words and drop both.
 * e.g. "Oakland Golden Grizzlies" → "Golden" matches → school = "Oakland"
 */
const MASCOT_PREFIXES = new Set([
  "golden", "blue", "red", "black", "fighting", "big", "great",
  "purple", "scarlet", "crimson", "wolf", "rainbow", "flying",
  "screaming", "mean", "sun", "green", "river", "orange",
]);

/**
 * Multi-word college school names (lowercase) where a word collides with
 * MASCOT_PREFIXES. These are checked first so the mascot-prefix heuristic
 * doesn't accidentally eat part of the school name.
 * e.g. "Bowling Green Falcons" — "Green" is a mascot prefix but here
 *      "Bowling Green" is the school.
 */
const COLLEGE_MULTI_WORD_SCHOOLS_UNSORTED: string[] = [
  "north carolina central",
  "north carolina state",
  "north carolina a&t",
  "south carolina state",
  "south carolina upstate",
  "south dakota state",
  "north dakota state",
  "central connecticut",
  "central michigan",
  "central arkansas",
  "central florida",
  "coastal carolina",
  "western carolina",
  "southeastern louisiana",
  "ut rio grande valley",
  "uc santa barbara",
  "southern mississippi",
  "army west point",
  "stephen f. austin",
  "mount st. mary's",
  "long beach state",
  "northern illinois",
  "southern illinois",
  "northern kentucky",
  "western kentucky",
  "eastern kentucky",
  "western michigan",
  "eastern michigan",
  "eastern washington",
  "western illinois",
  "eastern illinois",
  "southern methodist",
  "southern university",
  "southern utah",
  "middle tennessee",
  "new mexico state",
  "washington state",
  "mississippi state",
  "san diego state",
  "san jose state",
  "colorado state",
  "oklahoma state",
  "michigan state",
  "north carolina",
  "south carolina",
  "south alabama",
  "south dakota",
  "north dakota",
  "north florida",
  "east carolina",
  "east tennessee state",
  "east tennessee",
  "south florida",
  "north texas",
  "west virginia",
  "northern iowa",
  "northern colorado",
  "northern arizona",
  "arizona state",
  "florida state",
  "florida atlantic",
  "florida international",
  "florida gulf coast",
  "bowling green",
  "boston college",
  "boston university",
  "saint joseph's",
  "saint peter's",
  "virginia tech",
  "georgia tech",
  "georgia state",
  "georgia southern",
  "louisiana tech",
  "louisiana monroe",
  "fresno state",
  "kansas state",
  "oregon state",
  "saint mary's",
  "old dominion",
  "wake forest",
  "rhode island",
  "stony brook",
  "saint louis",
  "sam houston",
  "sacred heart",
  "grand canyon",
  "new hampshire",
  "new orleans",
  "new mexico",
  "little rock",
  "high point",
  "holy cross",
  "boise state",
  "texas tech",
  "texas state",
  "texas southern",
  "penn state",
  "ohio state",
  "iowa state",
  "ball state",
  "kent state",
  "green bay",
  "air force",
  "le moyne",
  "uc riverside",
  "uc irvine",
  "uc davis",
  "ut arlington",
  "ut martin",
];
// Sort longest-first so "south carolina state" matches before "south carolina"
const COLLEGE_MULTI_WORD_SCHOOLS = COLLEGE_MULTI_WORD_SCHOOLS_UNSORTED.sort(
  (a, b) => b.length - a.length,
);

function extractNickname(fullName: string): string {
  const lower = fullName.toLowerCase();
  for (const multi of PRO_MULTI_WORD) {
    if (lower.endsWith(multi)) {
      return fullName.slice(fullName.length - multi.length);
    }
  }
  const parts = fullName.split(" ");
  return parts[parts.length - 1];
}

function extractSchoolName(fullName: string): string {
  const lower = fullName.toLowerCase();

  // 1. Explicit multi-word mascot list (handles 3+ word and irregular mascots)
  for (const multi of COLLEGE_MULTI_WORD) {
    if (lower.endsWith(multi)) {
      return fullName.slice(0, fullName.length - multi.length).trim();
    }
  }

  // 2. Known multi-word school names — if the name starts with one,
  //    the rest is the mascot; return the school portion.
  for (const school of COLLEGE_MULTI_WORD_SCHOOLS) {
    if (lower.startsWith(school + " ") || lower === school) {
      return fullName.slice(0, school.length);
    }
  }

  // 3. Mascot-prefix heuristic: if second-to-last word is a common mascot
  //    prefix, the mascot is two words — drop both.
  const parts = fullName.split(" ");
  if (parts.length >= 3) {
    const secondToLast = parts[parts.length - 2].toLowerCase();
    if (MASCOT_PREFIXES.has(secondToLast)) {
      return parts.slice(0, -2).join(" ");
    }
  }

  // 4. Default: drop last word (single-word mascot)
  if (parts.length <= 1) return fullName;
  return parts.slice(0, -1).join(" ");
}

/**
 * Derive a short display name for a game card.
 * - College leagues: school name (strip mascot)
 * - Pro leagues: nickname/mascot (strip city)
 * - If result > 15 chars, fall back to abbreviation
 */
export function cardDisplayName(
  fullName: string,
  leagueCode: string,
  abbr?: string,
): string {
  const isCollege = COLLEGE_LEAGUES.has(leagueCode.toLowerCase());
  const name = isCollege ? extractSchoolName(fullName) : extractNickname(fullName);
  if (name.length > 15 && abbr) return abbr;
  return name;
}

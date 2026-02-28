import type { OddsFormat } from "./types";

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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
const COLLEGE_MULTI_WORD_SCHOOLS: string[] = [
  "bowling green",
  "green bay",
  "ball state",        // no collision, but safety
  "boston college",
  "san diego state",
  "san jose state",
  "fresno state",
  "boise state",
  "colorado state",
  "ohio state",
  "michigan state",
  "penn state",
  "florida state",
  "iowa state",
  "kansas state",
  "oklahoma state",
  "oregon state",
  "washington state",
  "mississippi state",
  "arizona state",
  "north carolina",
  "south carolina",
  "west virginia",
  "virginia tech",
  "georgia tech",
  "texas tech",
  "louisiana tech",
  "boston university",
  "mount st. mary's",
  "saint mary's",
  "saint louis",
  "saint peter's",
  "saint joseph's",
  "stony brook",
  "long beach state",
  "south florida",
  "central florida",
  "north texas",
  "middle tennessee",
  "east carolina",
  "western kentucky",
  "eastern kentucky",
  "western michigan",
  "eastern michigan",
  "northern illinois",
  "southern illinois",
  "southern mississippi",
  "northern iowa",
  "southern methodist",
  "old dominion",
  "wake forest",
  "air force",
  "army west point",
  "rhode island",
  "new mexico",
  "new mexico state",
  "new hampshire",
  "new orleans",
  "grand canyon",
  "little rock",
  "le moyne",
  "sacred heart",
  "holy cross",
  "high point",
  "sam houston",
  "southeastern louisiana",
  "stephen f. austin",
  "uc davis",
  "uc irvine",
  "uc riverside",
  "uc santa barbara",
  "ut arlington",
  "ut martin",
  "ut rio grande valley",
];

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

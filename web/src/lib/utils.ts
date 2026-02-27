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

/** Multi-word college mascots (lowercase). */
const COLLEGE_MULTI_WORD: string[] = [
  "blue devils",
  "big red",
  "tar heels",
  "fighting irish",
  "crimson tide",
  "yellow jackets",
  "golden eagles",
  "purple eagles",
  "scarlet knights",
  "nittany lions",
  "golden gophers",
  "red raiders",
  "horned frogs",
  "blue hens",
  "golden bears",
  "sun devils",
  "mean green",
  "red storm",
  "blue demons",
  "green wave",
  "river hawks",
  "red hawks",
  "fighting illini",
  "orange men",
  "golden flashes",
  "screaming eagles",
  "golden griffins",
  "purple aces",
  "flying dutchmen",
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
  for (const multi of COLLEGE_MULTI_WORD) {
    if (lower.endsWith(multi)) {
      return fullName.slice(0, fullName.length - multi.length).trim();
    }
  }
  const parts = fullName.split(" ");
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

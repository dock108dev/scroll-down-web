/**
 * Pure filter and sort logic for FairBet bets.
 * Extracted from useFairBetOdds to keep the hook focused on data fetching
 * and to make filtering independently testable.
 */

import type { APIBet } from "@/lib/types";
import { FAIRBET } from "@/lib/config";
import { betId, isReliablyPositive, marketKeyToCategory } from "@/lib/fairbet-utils";

// ── Types ──────────────────────────────────────────────────────────

export type SortMode = "bestEV" | "gameTime" | "league";

export type ConfidenceLevel = "" | "low" | "medium" | "high";
export type TimeToGame = "" | "1h" | "3h" | "today";

export interface FairBetFilters {
  league: string;
  market: string; // moneyline | spread | total | player_props | team_props | ""
  book: string;
  searchText: string;
  evOnly: boolean;
  hideThin: boolean;
  hideStarted: boolean;
  sort: SortMode;
  // Pro-only advanced filters
  confidence: ConfidenceLevel;
  sport: string;
  timeToGame: TimeToGame;
}

export const DEFAULT_FILTERS: FairBetFilters = {
  league: "",
  market: "",
  book: "",
  searchText: "",
  evOnly: false,
  hideThin: true,
  hideStarted: false,
  sort: "bestEV",
  confidence: "",
  sport: "",
  timeToGame: "",
};

// ── Sport mapping ─────────────────────────────────────────────────

const SPORT_BY_LEAGUE: Record<string, string> = {
  nba: "Basketball",
  ncaab: "Basketball",
  wnba: "Basketball",
  nba_g_league: "Basketball",
  nfl: "Football",
  ncaaf: "Football",
  mlb: "Baseball",
  nhl: "Hockey",
  mls: "Soccer",
  nwsl: "Soccer",
  pga: "Golf",
  lpga: "Golf",
  ufc: "MMA",
  boxing: "Boxing",
  tennis: "Tennis",
};

export function sportForLeague(league: string | null | undefined): string {
  if (!league) return "";
  return SPORT_BY_LEAGUE[league.toLowerCase()] ?? league.toUpperCase();
}

// ── Helpers ────────────────────────────────────────────────────────

/** Best EV percent for a bet from the API-provided field. */
export function bestEVForBet(bet: APIBet): number {
  return bet.bestEvPercent ?? 0;
}

const HIGH_CONFIDENCE_TIERS = new Set(["full", "sharp", "high"]);
const MEDIUM_CONFIDENCE_TIERS = new Set(["full", "sharp", "high", "decent", "market", "medium"]);

function meetsConfidenceFilter(bet: APIBet, level: ConfidenceLevel): boolean {
  if (!level || level === "low") return true;
  const tier = bet.ev_confidence_tier ?? "";
  const sample = bet.confidence;

  if (level === "high") {
    const tierOk = HIGH_CONFIDENCE_TIERS.has(tier);
    const sampleOk = sample == null || sample >= FAIRBET.CONFIDENCE_SAMPLE_HIGH;
    return tierOk && sampleOk;
  }
  // "medium"
  const tierOk = MEDIUM_CONFIDENCE_TIERS.has(tier);
  const sampleOk = sample == null || sample >= FAIRBET.CONFIDENCE_SAMPLE_MEDIUM;
  return tierOk && sampleOk;
}

const easternFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function meetsTimeToGame(bet: APIBet, window: TimeToGame): boolean {
  if (!window) return true;
  const gameTime = new Date(bet.game_date).getTime();
  if (isNaN(gameTime)) return true; // can't filter malformed dates
  const now = Date.now();

  if (window === "1h") return gameTime <= now + 3_600_000;
  if (window === "3h") return gameTime <= now + 10_800_000;
  if (window === "today") {
    return easternFmt.format(gameTime) === easternFmt.format(now);
  }
  return true;
}

// ── Filter + Sort ──────────────────────────────────────────────────

/** Apply all active filters and sort to a bet list. Pure function. */
export function filterAndSortBets(allBets: APIBet[], filters: FairBetFilters): APIBet[] {
  const now = new Date();
  let result = allBets;

  // Minimum book count
  result = result.filter((b) => b.books.length >= FAIRBET.MIN_BOOKS);

  // Deduplicate by betId (API can return same market from different methods)
  const seen = new Set<string>();
  result = result.filter((b) => {
    const id = betId(b);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (filters.league) {
    const fl = filters.league.toLowerCase();
    result = result.filter((b) => (b.league_code ?? "").toLowerCase() === fl);
  }

  if (filters.market) {
    result = result.filter(
      (b) => marketKeyToCategory(b.market_key ?? "") === filters.market,
    );
  }

  if (filters.book) {
    const fb = filters.book.toLowerCase();
    result = result.filter(
      (b) => b.books?.some((bp) => (bp.book ?? "").toLowerCase() === fb),
    );
  }

  if (filters.searchText) {
    const q = filters.searchText.toLowerCase();
    result = result.filter((b) =>
      (b.home_team ?? "").toLowerCase().includes(q) ||
      (b.away_team ?? "").toLowerCase().includes(q) ||
      (b.selection_key ?? "").toLowerCase().includes(q) ||
      (b.player_name ?? "").toLowerCase().includes(q),
    );
  }

  if (filters.evOnly) {
    result = result.filter((b) =>
      isReliablyPositive(bestEVForBet(b), b.ev_confidence_tier),
    );
  }

  if (filters.hideThin) {
    result = result.filter(
      (b) => b.ev_confidence_tier !== "thin" && b.ev_confidence_tier !== "none",
    );
  }

  if (filters.hideStarted) {
    result = result.filter((b) => new Date(b.game_date) > now);
  }

  // Pro-only advanced filters
  if (filters.sport) {
    result = result.filter((b) => sportForLeague(b.league_code) === filters.sport);
  }

  if (filters.confidence) {
    result = result.filter((b) => meetsConfidenceFilter(b, filters.confidence));
  }

  if (filters.timeToGame) {
    result = result.filter((b) => meetsTimeToGame(b, filters.timeToGame));
  }

  // Sort
  switch (filters.sort) {
    case "bestEV":
      result = [...result].sort((a, b) => bestEVForBet(b) - bestEVForBet(a));
      break;
    case "gameTime":
      result = [...result].sort(
        (a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime(),
      );
      break;
    case "league":
      result = [...result].sort((a, b) => {
        const cmp = a.league_code.localeCompare(b.league_code);
        return cmp !== 0 ? cmp : bestEVForBet(b) - bestEVForBet(a);
      });
      break;
  }

  return result;
}

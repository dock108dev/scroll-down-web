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

export interface FairBetFilters {
  league: string;
  market: string; // moneyline | spread | total | player_props | team_props | ""
  book: string;
  searchText: string;
  evOnly: boolean;
  hideThin: boolean;
  hideStarted: boolean;
  sort: SortMode;
}

export const DEFAULT_FILTERS: FairBetFilters = {
  league: "",
  market: "",
  book: "",
  searchText: "",
  evOnly: false,
  hideThin: false,
  hideStarted: false,
  sort: "bestEV",
};

// ── Helpers ────────────────────────────────────────────────────────

/** Best EV percent for a bet from the API-provided field. */
export function bestEVForBet(bet: APIBet): number {
  return bet.bestEvPercent ?? 0;
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
    result = result.filter(
      (b) => b.league_code.toLowerCase() === filters.league.toLowerCase(),
    );
  }

  if (filters.market) {
    result = result.filter(
      (b) => marketKeyToCategory(b.market_key) === filters.market,
    );
  }

  if (filters.book) {
    result = result.filter(
      (b) => b.books.some((bp) => bp.book.toLowerCase() === filters.book.toLowerCase()),
    );
  }

  if (filters.searchText) {
    const q = filters.searchText.toLowerCase();
    result = result.filter((b) =>
      b.home_team.toLowerCase().includes(q) ||
      b.away_team.toLowerCase().includes(q) ||
      b.selection_key.toLowerCase().includes(q) ||
      (b.player_name && b.player_name.toLowerCase().includes(q)),
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

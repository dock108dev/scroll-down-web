/**
 * FairBet utility functions matching iOS FairBet system.
 *
 * Covers formatting, probability math, EV classification,
 * confidence labelling, market-key-to-label mapping,
 * selection display, and client-side bet enrichment.
 */

import { FairBetTheme } from "./theme";
import type { APIBet } from "./types";

// ── Formatting ─────────────────────────────────────────────────────

/** Format EV percent with sign: "+5.2%" or "-2.1%" */
export function formatEV(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

/** Format probability as percentage: "52.3%" */
export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

// ── Confidence ─────────────────────────────────────────────────────

/**
 * Map API confidence tier to display label.
 * API sends: "full" (sharp), "decent" (market), "thin" (thin)
 */
export function getConfidenceLabel(tier?: string): string {
  switch (tier) {
    case "full":
    case "sharp":
    case "high":
      return "Sharp";
    case "decent":
    case "market":
    case "medium":
      return "Market";
    case "thin":
    case "low":
      return "Thin";
    default:
      return "N/A";
  }
}

export function getConfidenceColor(tier?: string): string {
  switch (tier) {
    case "full":
    case "sharp":
    case "high":
      return FairBetTheme.positive;
    case "decent":
    case "market":
    case "medium":
      return FairBetTheme.positiveMuted;
    case "thin":
    case "low":
      return FairBetTheme.neutral;
    default:
      return FairBetTheme.neutral;
  }
}

/** Check if a confidence tier qualifies as reliable (not thin/none). */
export function isConfidenceReliable(tier?: string): boolean {
  return tier === "full" || tier === "sharp" || tier === "high" ||
    tier === "decent" || tier === "market" || tier === "medium";
}

// ── EV colour tiers ────────────────────────────────────────────────

/** Get EV display colour by tier threshold. */
export function getEVColor(ev: number): string {
  if (ev >= 5) return FairBetTheme.positive;
  if (ev > 0) return FairBetTheme.positiveMuted;
  if (ev < 0) return FairBetTheme.negative;
  return FairBetTheme.neutral;
}

// ── Method display names ───────────────────────────────────────────

const METHOD_DISPLAY_NAMES: Record<string, string> = {
  pinnacle_shin: "Pinnacle Devig (Shin's)",
  pinnacle_extrapolated: "Pinnacle Extrapolated (Shin's)",
  paired_vig_removal: "Paired vig removal",
  median_consensus: "Median consensus",
  sharp_reference: "Sharp book reference",
};

export function getMethodDisplayName(method?: string): string {
  if (!method) return "Unknown method";
  return METHOD_DISPLAY_NAMES[method] ?? method.replace(/_/g, " ");
}

const METHOD_EXPLANATIONS: Record<string, string> = {
  pinnacle_shin:
    "Uses Pinnacle's sharp line as a reference. Vig is removed using Shin's model, which accounts for the favourite-longshot bias inherent in sports betting markets.",
  pinnacle_extrapolated:
    "Pinnacle doesn't list this exact market, so we extrapolated from the closest available line using Shin's devig model to estimate the fair probability.",
  paired_vig_removal:
    "Both sides of this market are available. The vig is split evenly and removed from each side to produce a fair probability estimate.",
  median_consensus:
    "No single sharp reference is available. The fair probability is the median implied probability across all books, which filters out outliers.",
  sharp_reference:
    "A sharp sportsbook (e.g. Pinnacle, Circa) directly prices this market. Their line, after vig removal, serves as the fair value reference.",
};

export function getMethodExplanation(method?: string): string {
  if (!method) return "The method used to estimate the fair probability for this market.";
  return METHOD_EXPLANATIONS[method] ?? "The method used to estimate the fair probability for this market.";
}

// ── Reliability ────────────────────────────────────────────────────

/** A bet is reliably positive EV when EV > 0 and confidence is not thin/none. */
export function isReliablyPositive(ev: number, confidence?: string): boolean {
  if (ev <= 0) return false;
  return isConfidenceReliable(confidence);
}

// ── Market labels ──────────────────────────────────────────────────

const MARKET_KEY_LABELS: Record<string, string> = {
  h2h: "Moneyline",
  moneyline: "Moneyline",
  spreads: "Spread",
  spread: "Spread",
  totals: "Total",
  total: "Total",
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "Threes",
  player_blocks: "Blocks",
  player_steals: "Steals",
  player_goals: "Goals",
  player_shots_on_goal: "Shots on Goal",
  player_total_saves: "Saves",
  player_pra: "Pts+Reb+Ast",
  team_total: "Team Total",
  alternate_spread: "Alt Spread",
  alternate_spreads: "Alt Spread",
  alternate_total: "Alt Total",
  alternate_totals: "Alt Total",
};

export function marketKeyToLabel(key: string): string {
  return MARKET_KEY_LABELS[key.toLowerCase()] ?? key.replace(/_/g, " ");
}

// ── Bet identity ───────────────────────────────────────────────────

/** Produce a unique ID string for a bet row. */
export function betId(bet: APIBet): string {
  return `${bet.game_id}::${bet.market_key}::${bet.selection_key}::${bet.line_value ?? ""}`;
}

// ── Selection display ──────────────────────────────────────────────

/**
 * Convert a raw selection_key slug into a human-readable team/player name.
 *
 * Examples:
 *   "team:louisville_cardinals" → "Louisville Cardinals"
 *   "player:luka_doncic" → "Luka Doncic"
 *   "Over" → "Over"
 */
function humaniseSelectionKey(key: string, bet: APIBet): string {
  if (key.startsWith("team:") || key.startsWith("player:")) {
    const slug = key.split(":")[1];
    const humanised = slug
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Try to match against the bet's home/away team for canonical casing
    const homeNorm = bet.home_team?.toLowerCase().trim();
    const awayNorm = bet.away_team?.toLowerCase().trim();
    const humanNorm = humanised.toLowerCase();
    if (homeNorm && humanNorm.includes(homeNorm)) return bet.home_team;
    if (awayNorm && humanNorm.includes(awayNorm)) return bet.away_team;
    if (homeNorm && homeNorm.includes(humanNorm)) return bet.home_team;
    if (awayNorm && awayNorm.includes(humanNorm)) return bet.away_team;

    return humanised;
  }

  if (key.includes("_") && !key.includes(" ")) {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return key;
}

/**
 * Format the selection display matching iOS APIBet.selectionDisplay logic.
 */
export function selectionDisplay(bet: APIBet): string {
  if (bet.bet_description && !bet.bet_description.includes(":")) {
    return bet.bet_description;
  }

  const selection = humaniseSelectionKey(bet.selection_key, bet);
  const marketLabel = marketKeyToLabel(bet.market_key);
  const marketLower = bet.market_key.toLowerCase();

  // Player props: "Luka Doncic Points Over 28.5"
  if (marketLower.startsWith("player_")) {
    const playerName = bet.player_name ?? selection;
    const side = bet.selection_key.startsWith("player:") ? "" : selection;
    if (bet.line_value != null) {
      return side
        ? `${playerName} ${marketLabel} ${side} ${bet.line_value}`
        : `${playerName} ${marketLabel} ${bet.line_value}`;
    }
    return `${playerName} ${marketLabel}`;
  }

  // Alternate markets: "Louisville Cardinals Alt Spread -7.5"
  if (marketLower.startsWith("alternate_")) {
    if (bet.line_value != null && bet.line_value !== 0) {
      const sign = bet.line_value > 0 ? "+" : "";
      return `${selection} ${marketLabel} ${sign}${bet.line_value}`;
    }
    return `${selection} ${marketLabel}`;
  }

  // Team props: "Celtics Team Total Over 108.5"
  if (marketLower === "team_total") {
    if (bet.line_value != null) {
      return `${selection} ${marketLabel} ${bet.line_value}`;
    }
    return `${selection} ${marketLabel}`;
  }

  // Mainline with line: "Boston Celtics -3.5"
  if (bet.line_value != null && bet.line_value !== 0) {
    const sign = bet.line_value > 0 ? "+" : "";
    return `${selection} ${sign}${bet.line_value}`;
  }

  // Moneyline: just the team name
  return selection;
}

// ── Probability / odds math ────────────────────────────────────────

/** Profit per $1 wagered for American odds. */
export function profitPerDollar(americanOdds: number): number {
  if (americanOdds > 0) return americanOdds / 100;
  return 100 / Math.abs(americanOdds);
}

/** Convert American odds to implied probability (0-1). */
export function americanToImpliedProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Convert probability (0-1) to American odds. */
export function impliedProbToAmerican(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    return Math.round(-prob / (1 - prob) * 100);
  }
  return Math.round((1 - prob) / prob * 100);
}

/**
 * Compute the fair American odds from a bet's true_prob.
 */
export function fairAmericanOdds(bet: APIBet): number | null {
  if (bet.true_prob == null || bet.true_prob <= 0 || bet.true_prob >= 1) return null;
  return impliedProbToAmerican(bet.true_prob);
}

// ── Market category mapping ────────────────────────────────────────

/** Map a market_key to a high-level market category for filtering. */
export function marketKeyToCategory(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "h2h" || lower === "moneyline") return "moneyline";
  if (lower === "spreads" || lower === "spread" || lower === "alternate_spread") return "spread";
  if (lower === "totals" || lower === "total" || lower === "alternate_total") return "total";
  if (lower.startsWith("player_")) return "player_props";
  if (lower === "team_total") return "team_props";
  return "other";
}

// ── Client-side bet enrichment ─────────────────────────────────────

const SHARP_BOOKS = new Set(["pinnacle", "circa", "bookmaker", "betcris"]);

/**
 * Enrich a raw API bet with computed display fields.
 * Only populates fields that the API didn't already provide.
 */
export function enrichBet(bet: APIBet): APIBet {
  const enriched = { ...bet, books: bet.books.map((b) => ({ ...b })) };

  // Display fields
  if (!enriched.selectionDisplay) {
    enriched.selectionDisplay = selectionDisplay(bet);
  }
  if (!enriched.marketDisplayName) {
    enriched.marketDisplayName = marketKeyToLabel(bet.market_key);
  }
  if (!enriched.confidenceDisplayLabel) {
    enriched.confidenceDisplayLabel = getConfidenceLabel(bet.ev_confidence_tier);
  }
  if (!enriched.evMethodDisplayName) {
    enriched.evMethodDisplayName = getMethodDisplayName(bet.ev_method);
  }
  if (!enriched.evMethodExplanation) {
    enriched.evMethodExplanation = getMethodExplanation(bet.ev_method);
  }

  // Fair odds from true probability
  if (enriched.fairAmericanOdds == null) {
    enriched.fairAmericanOdds = fairAmericanOdds(bet) ?? undefined;
  }

  // has_fair
  if (enriched.has_fair == null) {
    enriched.has_fair = bet.true_prob != null && bet.true_prob > 0;
  }

  // Per-book enrichment: implied probs, EV, sharp flag
  for (const bp of enriched.books) {
    if (bp.implied_prob == null) {
      bp.implied_prob = americanToImpliedProb(bp.price);
    }
    if (bp.is_sharp == null) {
      bp.is_sharp = SHARP_BOOKS.has(bp.book.toLowerCase());
    }
    if (bp.ev_percent == null && bet.true_prob != null && bet.true_prob > 0) {
      const profit = profitPerDollar(bp.price);
      bp.ev_percent = (bet.true_prob * (1 + profit) - 1) * 100;
    }
  }

  // Best book + best EV
  if (!enriched.bestBook || enriched.bestEvPercent == null) {
    let bestEv = -Infinity;
    let bestBookName = "";
    for (const bp of enriched.books) {
      if ((bp.ev_percent ?? -Infinity) > bestEv) {
        bestEv = bp.ev_percent ?? -Infinity;
        bestBookName = bp.book;
      }
    }
    if (bestEv > -Infinity) {
      enriched.bestBook = bestBookName;
      enriched.bestEvPercent = bestEv;
    }
  }

  return enriched;
}

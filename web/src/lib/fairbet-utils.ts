/**
 * FairBet utility functions.
 *
 * Covers formatting, EV classification, confidence labelling,
 * market-key-to-label mapping, selection display, and
 * light client-side enrichment (display labels only — all math
 * comes from the data API).
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
 * API sends: "full", "decent", "thin"
 */
export function getConfidenceLabel(tier?: string): string {
  switch (tier) {
    case "full":
    case "sharp":
    case "high":
      return "Strong";
    case "decent":
    case "market":
    case "medium":
      return "Decent";
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
  pinnacle_devig: "Pinnacle Devig",
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
  pinnacle_devig:
    "Fair odds derived by removing vig from Pinnacle's line using Shin's devig model.",
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

// ── Market category mapping ────────────────────────────────────────

/** Map a market_key to a high-level market category for filtering. */
export function marketKeyToCategory(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "h2h" || lower === "moneyline") return "moneyline";
  if (lower === "spreads" || lower === "spread" || lower === "alternate_spread" || lower === "alternate_spreads") return "spread";
  if (lower === "totals" || lower === "total" || lower === "alternate_total" || lower === "alternate_totals") return "total";
  if (lower.startsWith("player_")) return "player_props";
  if (lower === "team_total") return "team_props";
  return "other";
}

// ── Bet identity ───────────────────────────────────────────────────

/** Produce a unique ID string for a bet row. */
export function betId(bet: APIBet): string {
  return `${bet.game_id}::${bet.market_key}::${bet.selection_key}::${bet.line_value ?? ""}`;
}

// ── Selection display ──────────────────────────────────────────────

function humaniseSelectionKey(key: string, bet: APIBet): string {
  if (key.startsWith("team:") || key.startsWith("player:")) {
    const slug = key.split(":")[1];
    const humanised = slug
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

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

export function selectionDisplay(bet: APIBet): string {
  if (bet.bet_description && !bet.bet_description.includes(":")) {
    return bet.bet_description;
  }

  const selection = humaniseSelectionKey(bet.selection_key, bet);
  const marketLabel = marketKeyToLabel(bet.market_key);
  const marketLower = bet.market_key.toLowerCase();

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

  if (marketLower.startsWith("alternate_")) {
    if (bet.line_value != null && bet.line_value !== 0) {
      const sign = bet.line_value > 0 ? "+" : "";
      return `${selection} ${marketLabel} ${sign}${bet.line_value}`;
    }
    return `${selection} ${marketLabel}`;
  }

  if (marketLower === "team_total") {
    if (bet.line_value != null) {
      return `${selection} ${marketLabel} ${bet.line_value}`;
    }
    return `${selection} ${marketLabel}`;
  }

  if (bet.line_value != null && bet.line_value !== 0) {
    const sign = bet.line_value > 0 ? "+" : "";
    return `${selection} ${sign}${bet.line_value}`;
  }

  return selection;
}

// ── Probability / odds helpers (for display only) ──────────────────

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

// ── Client-side bet enrichment ─────────────────────────────────────

/**
 * Enrich a raw API bet with display label fallbacks only.
 * All math (EV, fair odds, implied probs) comes from the API.
 */
export function enrichBet(bet: APIBet): APIBet {
  const enriched = { ...bet, books: bet.books.map((b) => ({ ...b })) };

  // Map API snake_case → camelCase aliases (prefer API values)
  enriched.fairAmericanOdds = bet.fair_american_odds ?? enriched.fairAmericanOdds;
  enriched.bestBook = bet.best_book ?? enriched.bestBook;
  enriched.bestEvPercent = bet.best_ev_percent ?? enriched.bestEvPercent;
  enriched.selectionDisplay = bet.selection_display ?? enriched.selectionDisplay;
  enriched.marketDisplayName = bet.market_display_name ?? enriched.marketDisplayName;
  enriched.confidenceDisplayLabel = bet.confidence_display_label ?? enriched.confidenceDisplayLabel;
  enriched.evMethodDisplayName = bet.ev_method_display_name ?? enriched.evMethodDisplayName;
  enriched.evMethodExplanation = bet.ev_method_explanation ?? enriched.evMethodExplanation;

  // Display label fallbacks (only if API didn't provide them)
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

  // Fair odds fallback from true_prob
  if (enriched.fairAmericanOdds == null && bet.true_prob != null && bet.true_prob > 0 && bet.true_prob < 1) {
    enriched.fairAmericanOdds = impliedProbToAmerican(bet.true_prob);
  }

  // has_fair fallback
  if (enriched.has_fair == null) {
    enriched.has_fair = bet.true_prob != null && bet.true_prob > 0;
  }

  return enriched;
}

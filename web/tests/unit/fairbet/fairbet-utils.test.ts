import { describe, it, expect } from "vitest";
import {
  formatEV,
  formatProbability,
  getConfidenceLabel,
  getEdgeLabel,
  getConfidenceColor,
  getEVColor,
  isReliablyPositive,
  isMainlineMarket,
  marketKeyToCategory,
  betId,
  selectionDisplay,
  computeCLV,
  probToDecimal,
  decimalToAmerican,
  parlayProbIndependent,
  evPct,
  legFairProb,
  hasCorrelatedLegs,
  parlayConfidenceTier,
  enrichBet,
  calcSpreadOutcome,
  calcTotalOutcome,
  calcMoneylineOutcome,
} from "@/lib/fairbet-utils";
import { FairBetTheme } from "@/lib/theme";
import type { APIBet } from "@/lib/types";

function makeBet(overrides: Partial<APIBet> = {}): APIBet {
  return {
    game_id: 1,
    league_code: "nba",
    home_team: "Boston Celtics",
    away_team: "New York Knicks",
    game_date: "2026-01-01T00:00:00Z",
    market_key: "spreads",
    selection_key: "Boston Celtics",
    books: [{ book: "draftkings", price: -110, observed_at: "2026-01-01T00:00:00Z" }],
    ...overrides,
  };
}

describe("fairbet-utils formatting and tiers", () => {
  it("formats EV and probabilities", () => {
    expect(formatEV(5.23)).toBe("+5.2%");
    expect(formatEV(-1.24)).toBe("-1.2%");
    expect(formatProbability(0.523)).toBe("52.3%");
  });

  it("maps confidence labels and colors", () => {
    expect(getConfidenceLabel("full")).toBe("Strong");
    expect(getConfidenceLabel("medium")).toBe("Medium");
    expect(getConfidenceLabel("low")).toBe("Small");
    expect(getConfidenceLabel("unknown")).toBe("");
    expect(getConfidenceColor("sharp")).toBe(FairBetTheme.positive);
    expect(getConfidenceColor("market")).toBe(FairBetTheme.positiveMuted);
    expect(getConfidenceColor("thin")).toBe(FairBetTheme.neutral);
  });

  it("maps edge labels and EV colors", () => {
    expect(getEdgeLabel(8)).toBe("Strong");
    expect(getEdgeLabel(3)).toBe("Medium");
    expect(getEdgeLabel(0.5)).toBe("Small");
    expect(getEdgeLabel(0.49)).toBe("None");
    expect(getEdgeLabel(Number.NaN)).toBe("None");
    expect(getEVColor(6)).toBe(FairBetTheme.positive);
    expect(getEVColor(1)).toBe(FairBetTheme.positiveMuted);
    expect(getEVColor(-1)).toBe(FairBetTheme.negative);
    expect(getEVColor(0)).toBe(FairBetTheme.neutral);
  });

  it("marks bets as reliably positive only with positive EV and reliable confidence", () => {
    expect(isReliablyPositive(1, "full")).toBe(true);
    expect(isReliablyPositive(1, "medium")).toBe(true);
    expect(isReliablyPositive(1, "low")).toBe(false);
    expect(isReliablyPositive(0, "full")).toBe(false);
  });
});

describe("fairbet-utils market and display helpers", () => {
  it("classifies market keys", () => {
    expect(isMainlineMarket("h2h")).toBe(true);
    expect(isMainlineMarket("spread")).toBe(true);
    expect(isMainlineMarket("team_total")).toBe(false);
    expect(isMainlineMarket(null)).toBe(false);
    expect(marketKeyToCategory("moneyline")).toBe("moneyline");
    expect(marketKeyToCategory("alternate_spreads")).toBe("spread");
    expect(marketKeyToCategory("alternate_total")).toBe("total");
    expect(marketKeyToCategory("player_points")).toBe("player_props");
    expect(marketKeyToCategory("team_total")).toBe("team_props");
    expect(marketKeyToCategory(undefined)).toBe("other");
  });

  it("builds stable bet IDs", () => {
    expect(betId(makeBet({ line_value: 3.5 }))).toBe("1::spreads::Boston Celtics::3.5");
    expect(betId(makeBet())).toBe("1::spreads::Boston Celtics::");
  });

  it("renders selection display across market families", () => {
    expect(selectionDisplay(makeBet({ bet_description: "Custom Label" }))).toBe("Custom Label");
    expect(selectionDisplay(makeBet({ market_key: "player_points", selection_key: "Over", player_name: "Jalen Brunson", line_value: 24.5 }))).toBe("Jalen Brunson Over 24.5 Pts");
    expect(selectionDisplay(makeBet({ market_key: "player_assists", selection_key: "player:jalen_brunson", player_name: "Jalen Brunson", line_value: 7.5 }))).toBe("Jalen Brunson 7.5 Ast");
    expect(selectionDisplay(makeBet({ market_key: "alternate_spread", selection_key: "Boston Celtics", line_value: 4.5 }))).toBe("Boston Celtics Alt Spread +4.5");
    expect(selectionDisplay(makeBet({ market_key: "team_total", selection_key: "Boston Celtics", line_value: 110.5 }))).toBe("Boston Celtics 110.5 Team Total");
    expect(selectionDisplay(makeBet({ market_key: "spreads", selection_key: "Boston Celtics", line_value: -2.5 }))).toBe("Boston Celtics -2.5");
    expect(selectionDisplay(makeBet({ market_key: "h2h", selection_key: "Boston Celtics" }))).toBe("Boston Celtics");
  });
});

describe("fairbet-utils odds math and parlay helpers", () => {
  it("computes CLV and conversion helpers", () => {
    expect(computeCLV(100, -110)).toBeGreaterThan(0);
    expect(Number.isNaN(computeCLV(0, -110))).toBe(true);
    expect(probToDecimal(0.5)).toBe(2);
    expect(probToDecimal(0)).toBe(Infinity);
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(1.5)).toBe(-200);
    expect(Number.isNaN(decimalToAmerican(1))).toBe(true);
  });

  it("computes parlay probability and EV", () => {
    expect(parlayProbIndependent([0.5, 0.4])).toBe(0.2);
    expect(Number.isNaN(parlayProbIndependent([]))).toBe(true);
    expect(Number.isNaN(parlayProbIndependent([0, 0.5]))).toBe(true);
    expect(evPct(0.5, 100)).toBe(0);
    expect(Number.isNaN(evPct(Number.NaN, 100))).toBe(true);
  });

  it("extracts fair probabilities and parlay confidence", () => {
    expect(legFairProb(makeBet({ true_prob: 0.55 }))).toBe(0.55);
    expect(legFairProb(makeBet({ true_prob: 1.2, fair_american_odds: -110 }))).toBeCloseTo(0.5238, 3);
    expect(legFairProb(makeBet({ fair_american_odds: 0 }))).toBeNull();
    expect(hasCorrelatedLegs([makeBet({ game_id: 1 }), makeBet({ game_id: 1 })])).toBe(true);
    expect(hasCorrelatedLegs([makeBet({ game_id: 1 }), makeBet({ game_id: 2 })])).toBe(false);
    expect(parlayConfidenceTier([makeBet(), makeBet({ game_id: 2 })], false, false)).toBe("none");
    expect(parlayConfidenceTier([makeBet(), makeBet({ game_id: 2 })], true, true)).toBe("low");
    expect(parlayConfidenceTier([makeBet(), makeBet({ game_id: 2 }), makeBet({ game_id: 3 }), makeBet({ game_id: 4 })], true, false)).toBe("low");
    expect(parlayConfidenceTier([makeBet(), makeBet({ game_id: 2 })], true, false)).toBe("medium");
  });
});

describe("fairbet-utils enrichment and settled outcomes", () => {
  it("enriches snake_case and fallback fields", () => {
    const raw = makeBet({
      market_key: "player_points",
      selection_key: "player:jalen_brunson",
      player_name: "Jalen Brunson",
      true_prob: 0.6,
      fair_american_odds: -140,
      best_book: "DraftKings",
      best_ev_percent: 5.1,
      ev_confidence_tier: "full",
      ev_method: "median_consensus",
      selection_display: "JALEN BRUNSON 24.5 PTS",
    });
    const enriched = enrichBet(raw);
    expect(enriched.fairAmericanOdds).toBe(-140);
    expect(enriched.bestBook).toBe("DraftKings");
    expect(enriched.bestEvPercent).toBe(5.1);
    expect(enriched.selectionDisplay).toBe("Jalen Brunson 24.5 Pts");
    expect(enriched.marketDisplayName).toBe("Points");
    expect(enriched.confidenceDisplayLabel).toBe("Strong");
    expect(enriched.evMethodDisplayName).toBe("Median consensus");
    expect(enriched.evMethodExplanation).toContain("median implied probability");
    expect(enriched.has_fair).toBe(true);
  });

  it("computes spread, total, and moneyline outcomes", () => {
    expect(calcSpreadOutcome("Boston Celtics", -2.5, "Boston Celtics", 110, 100)).toBe("covered");
    expect(calcSpreadOutcome("Boston Celtics", -10, "Boston Celtics", 110, 100)).toBe("pushed");
    expect(calcSpreadOutcome("Boston Celtics", -11, "Boston Celtics", 110, 100)).toBe("lost");
    expect(calcTotalOutcome("Over", 200, 110, 100)).toBe("covered");
    expect(calcTotalOutcome("Under", 210, 110, 100)).toBe("pushed");
    expect(calcTotalOutcome("Over", 210, 110, 100)).toBe("pushed");
    expect(calcMoneylineOutcome("Boston Celtics", "Boston Celtics", 110, 100)).toBe("won");
    expect(calcMoneylineOutcome("Boston Celtics", "Boston Celtics", 100, 100)).toBe("pushed");
    expect(calcMoneylineOutcome("Boston Celtics", "Boston Celtics", 95, 100)).toBe("lost");
  });
});

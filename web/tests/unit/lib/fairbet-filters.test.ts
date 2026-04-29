import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_FILTERS,
  sportForLeague,
  bestEVForBet,
  filterAndSortBets,
} from "@/lib/fairbet-filters";
import type { APIBet } from "@/lib/types";

function book(
  name: string,
  price: number,
  ev: number,
) {
  return { book: name, price, observed_at: "2026-01-01T00:00:00Z", display_ev: ev };
}

function makeBet(overrides: Partial<APIBet> = {}): APIBet {
  return {
    game_id: 1,
    league_code: "nba",
    home_team: "Boston Celtics",
    away_team: "New York Knicks",
    game_date: new Date(Date.now() + 3_600_000).toISOString(),
    market_key: "h2h",
    selection_key: "team:celtics",
    ev_confidence_tier: "full",
    books: [book("draftkings", -110, 6), book("fanduel", -108, 5), book("betmgm", -112, 4)],
    ...overrides,
  };
}

describe("fairbet-filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T16:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps leagues to sports and uppercases unknown", () => {
    expect(sportForLeague("nba")).toBe("Basketball");
    expect(sportForLeague("NCAAB")).toBe("Basketball");
    expect(sportForLeague("xyz")).toBe("XYZ");
    expect(sportForLeague("")).toBe("");
  });

  it("picks best EV from the book with highest price", () => {
    expect(bestEVForBet(makeBet({ books: [] }))).toBe(0);
    const b = makeBet({
      books: [
        { book: "a", price: -200, observed_at: "", display_ev: 1 },
        { book: "b", price: 150, observed_at: "", display_ev: 7 },
        { book: "c", price: 140, observed_at: "", ev_percent: 2 },
      ],
    });
    expect(bestEVForBet(b)).toBe(7);
  });

  it("filters by min books, dedupes, league, market, book, and search", () => {
    const base = makeBet();
    const dup = { ...base, books: base.books };
    const otherLeague = makeBet({ game_id: 2, league_code: "nfl" });
    const thinBooks = makeBet({ game_id: 3, books: [book("a", -110, 5), book("b", -108, 4)] });
    const spread = makeBet({
      game_id: 4,
      market_key: "spreads",
      selection_key: "team:celtics",
      line_value: -3.5,
    });

    let out = filterAndSortBets([base, dup, otherLeague, thinBooks, spread], DEFAULT_FILTERS);
    expect(out.map((b) => b.game_id)).toEqual([1, 2, 4]);

    out = filterAndSortBets([base, otherLeague], {
      ...DEFAULT_FILTERS,
      league: "nba",
    });
    expect(out.every((b) => b.league_code === "nba")).toBe(true);

    out = filterAndSortBets([base, spread], {
      ...DEFAULT_FILTERS,
      market: "moneyline",
    });
    expect(out.every((b) => (b.market_key ?? "").toLowerCase().includes("h2h") || (b.market_key ?? "").includes("money"))).toBe(true);
    expect(out[0].game_id).toBe(1);

    out = filterAndSortBets([base, spread], {
      ...DEFAULT_FILTERS,
      market: "spread",
    });
    expect(out.map((b) => b.game_id)).toEqual([4]);

    out = filterAndSortBets([base], {
      ...DEFAULT_FILTERS,
      book: "FANDUEL",
    });
    expect(out.length).toBe(1);

    out = filterAndSortBets([base], {
      ...DEFAULT_FILTERS,
      searchText: "knicks",
    });
    expect(out.length).toBe(1);
  });

  it("respects evOnly, hideThin, hideAlts, and hideStarted", () => {
    const reliable = makeBet({ game_id: 10, ev_confidence_tier: "full" });
    const thin = makeBet({
      game_id: 11,
      ev_confidence_tier: "thin",
      books: reliable.books,
    });
    const started = makeBet({
      game_id: 12,
      game_date: new Date("2026-06-15T12:00:00.000Z").toISOString(),
      books: reliable.books,
    });

    const altLow = makeBet({
      game_id: 20,
      market_key: "alternate_totals",
      selection_key: "Over",
      player_name: undefined,
      line_value: 200.5,
      books: [
        book("draftkings", -110, 3),
        book("fanduel", -108, 2),
        book("betmgm", -112, 1),
      ],
    });
    const altHigh = makeBet({
      game_id: 20,
      market_key: "alternate_totals",
      selection_key: "Over",
      line_value: 210.5,
      books: [
        book("draftkings", -110, 9),
        book("fanduel", -108, 8),
        book("betmgm", -112, 7),
      ],
    });

    let out = filterAndSortBets([reliable, thin], {
      ...DEFAULT_FILTERS,
      hideThin: true,
    });
    expect(out.map((b) => b.game_id)).toEqual([10]);

    out = filterAndSortBets([reliable], {
      ...DEFAULT_FILTERS,
      evOnly: false,
    });
    expect(out.length).toBe(1);

    out = filterAndSortBets([started], {
      ...DEFAULT_FILTERS,
      hideStarted: true,
    });
    expect(out.length).toBe(0);

    out = filterAndSortBets([altLow, altHigh], {
      ...DEFAULT_FILTERS,
      hideAlts: true,
      evOnly: false,
    });
    expect(out.length).toBe(1);
    expect(out[0].line_value).toBe(210.5);
  });

  it("applies sport, confidence, time window, and sort modes", () => {
    const nba = makeBet({ game_id: 30, league_code: "nba" });
    const nfl = makeBet({ game_id: 31, league_code: "nfl", market_key: "h2h", selection_key: "a" });

    let out = filterAndSortBets([nba, nfl], {
      ...DEFAULT_FILTERS,
      sport: "Basketball",
    });
    expect(out.every((b) => b.league_code === "nba")).toBe(true);

    const highOk = makeBet({
      game_id: 40,
      ev_confidence_tier: "high",
      confidence: 40,
    });
    const highBadSample = makeBet({
      game_id: 41,
      ev_confidence_tier: "high",
      confidence: 5,
      market_key: "h2h",
      selection_key: "b",
    });
    out = filterAndSortBets([highOk, highBadSample], {
      ...DEFAULT_FILTERS,
      confidence: "high",
    });
    expect(out.map((b) => b.game_id)).toEqual([40]);

    const mediumTier = makeBet({
      game_id: 42,
      ev_confidence_tier: "decent",
      market_key: "h2h",
      selection_key: "c",
    });
    out = filterAndSortBets([mediumTier], {
      ...DEFAULT_FILTERS,
      confidence: "medium",
    });
    expect(out.length).toBe(1);

    const soon = makeBet({
      game_id: 50,
      game_date: new Date("2026-06-15T16:30:00.000Z").toISOString(),
      market_key: "h2h",
      selection_key: "d",
    });
    out = filterAndSortBets([soon], {
      ...DEFAULT_FILTERS,
      timeToGame: "1h",
    });
    expect(out.length).toBe(1);

    const a = makeBet({ game_id: 60, game_date: "2026-06-16T12:00:00.000Z" });
    const b = makeBet({ game_id: 61, game_date: "2026-06-15T14:00:00.000Z", market_key: "h2h", selection_key: "e" });
    out = filterAndSortBets([a, b], { ...DEFAULT_FILTERS, sort: "gameTime" });
    expect(out[0].game_id).toBe(61);

    out = filterAndSortBets(
      [
        makeBet({ game_id: 70, league_code: "mlb", market_key: "h2h", selection_key: "f" }),
        makeBet({ game_id: 71, league_code: "nba", market_key: "h2h", selection_key: "g" }),
      ],
      { ...DEFAULT_FILTERS, sort: "league" },
    );
    expect(out[0].league_code).toBe("mlb");
  });

  it("keeps malformed game dates when time filtering", () => {
    const badDate = makeBet({
      game_id: 99,
      game_date: "not-a-date",
      market_key: "h2h",
      selection_key: "z",
    });
    const out = filterAndSortBets([badDate], {
      ...DEFAULT_FILTERS,
      timeToGame: "1h",
    });
    expect(out.length).toBe(1);
  });
});

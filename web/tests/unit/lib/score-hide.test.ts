import { describe, it, expect } from "vitest";
import { isGameHiddenByBlacklist } from "@/lib/score-hide";
import type { GameCore } from "@/stores/game-data";

function core(overrides: Partial<GameCore> = {}): GameCore {
  return {
    id: 1,
    leagueCode: "nba",
    gameDate: "2026-01-01T00:00:00Z",
    status: "scheduled",
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

describe("isGameHiddenByBlacklist", () => {
  it("returns false when lists are empty", () => {
    expect(isGameHiddenByBlacklist(core(), [], [])).toBe(false);
  });

  it("hides when league matches", () => {
    const leagues = ["nba"];
    expect(isGameHiddenByBlacklist(core({ leagueCode: "NBA" }), leagues, [])).toBe(true);
  });

  it("hides when team name or abbr matches", () => {
    expect(isGameHiddenByBlacklist(core(), [], ["boston celtics"])).toBe(true);
    expect(
      isGameHiddenByBlacklist(core({ homeTeamAbbr: "BOS" }), [], ["bos"]),
    ).toBe(true);
  });
});

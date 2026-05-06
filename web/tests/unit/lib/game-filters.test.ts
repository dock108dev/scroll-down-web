import { describe, it, expect } from "vitest";
import { filterOutTbdGames, hasTbdMatchup, isTbdTeamName } from "@/lib/game-filters";

describe("game TBD filters", () => {
  it("detects TBD team names", () => {
    expect(isTbdTeamName("TBD")).toBe(true);
    expect(isTbdTeamName(" tbd ")).toBe(true);
    expect(isTbdTeamName("Sabres")).toBe(false);
  });

  it("flags a matchup when either side is TBD", () => {
    expect(hasTbdMatchup({ awayTeam: "TBD", homeTeam: "Sabres" })).toBe(true);
    expect(hasTbdMatchup({ awayTeam: "Canadiens", homeTeam: "TBD" })).toBe(true);
    expect(hasTbdMatchup({ awayTeam: "Canadiens", homeTeam: "Sabres" })).toBe(false);
  });

  it("filters out games with TBD on either side", () => {
    const games = [
      { id: 1, awayTeam: "TBD", homeTeam: "Sabres" },
      { id: 2, awayTeam: "Canadiens", homeTeam: "Sabres" },
      { id: 3, awayTeam: "Leafs", homeTeam: "TBD" },
    ];

    expect(filterOutTbdGames(games)).toEqual([
      { id: 2, awayTeam: "Canadiens", homeTeam: "Sabres" },
    ]);
  });
});

import { describe, it, expect } from "vitest";
import type { BoxScoreInput } from "@/lib/salient-events";
import type { PlayEntry, PlayerStat } from "@/lib/types";
import { extractSalientEvents } from "@/lib/salient-events";

describe("extractSalientEvents sport branches", () => {
  it("classifies NFL totals and extracts standouts when stats provided", () => {
    const plays: PlayEntry[] = [
      {
        playIndex: 1,
        scoreChanged: true,
        homeScore: 7,
        awayScore: 0,
        quarter: 1,
      },
      {
        playIndex: 2,
        scoreChanged: true,
        homeScore: 7,
        awayScore: 7,
        quarter: 2,
      },
    ];
    const playerStats: PlayerStat[] = [
      {
        team: "KC",
        playerName: "QB One",
        rawStats: { passingYards: 310 },
      },
    ];
    const input: BoxScoreInput = {
      sport: "NFL",
      homeTeam: "KC",
      awayTeam: "SF",
      homeScore: 31,
      awayScore: 17,
      plays,
      playerStats,
    };
    const r = extractSalientEvents(input);
    expect(r.narrativeType).toBeDefined();
    expect(r.events.length).toBeGreaterThan(0);
  });

  it("runs MLB standout extraction path", () => {
    const input: BoxScoreInput = {
      sport: "MLB",
      homeTeam: "NYY",
      awayTeam: "BOS",
      homeScore: 5,
      awayScore: 2,
      plays: [],
      mlbBatters: [
        {
          team: "NYY",
          playerName: "Slugger",
          homeRuns: 2,
          rbi: 4,
        },
      ],
      mlbPitchers: [],
    };
    const r = extractSalientEvents(input);
    expect(r.events.some((e) => e.type === "standout-stat")).toBe(true);
  });
});

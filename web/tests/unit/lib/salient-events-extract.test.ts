import { describe, it, expect } from "vitest";
import type { BoxScoreInput } from "@/lib/salient-events";
import type { PlayEntry } from "@/lib/types";
import { extractSalientEvents } from "@/lib/salient-events";

describe("extractSalientEvents", () => {
  it("returns sorted events and narrative for NBA box", () => {
    const plays: PlayEntry[] = [
      {
        playIndex: 1,
        scoreChanged: true,
        homeScore: 2,
        awayScore: 0,
        quarter: 1,
      },
      {
        playIndex: 2,
        scoreChanged: true,
        homeScore: 2,
        awayScore: 4,
        quarter: 1,
      },
    ];
    const input: BoxScoreInput = {
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 100,
      awayScore: 98,
      plays,
    };
    const { events, narrativeType } = extractSalientEvents(input);
    expect(narrativeType).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].impactWeight).toBeGreaterThanOrEqual(events[i].impactWeight);
    }
  });

  it("handles empty plays without throwing", () => {
    const input: BoxScoreInput = {
      sport: "NHL",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 3,
      awayScore: 1,
      plays: [],
    };
    expect(extractSalientEvents(input).narrativeType).toBeDefined();
  });
});

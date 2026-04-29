import { describe, it, expect } from "vitest";
import type { BoxScoreInput, SalientEventResult, NarrativeType } from "@/lib/salient-events";
import { buildStorySlots, fillTemplate } from "@/lib/story-templates";

const baseInput: BoxScoreInput = {
  sport: "NBA",
  homeTeam: "Home",
  awayTeam: "Away",
  homeScore: 110,
  awayScore: 102,
};

const baseResult: SalientEventResult = {
  narrativeType: "dominant",
  events: [
    { type: "standout-stat", description: "Star had 40 pts", impactWeight: 90 },
    { type: "key-play", description: "Clutch three", impactWeight: 85 },
    { type: "scoring-run", description: "12-2 run", impactWeight: 80 },
    { type: "lead-change", description: "Took lead", impactWeight: 70 },
    { type: "lead-change", description: "Again", impactWeight: 65 },
  ],
};

describe("buildStorySlots", () => {
  it("fills slots from salient events and picks winner side", () => {
    const slots = buildStorySlots(baseInput, baseResult);
    expect(slots.winner).toBe("Home");
    expect(slots.loser).toBe("Away");
    expect(slots.winnerScore).toBe(110);
    expect(slots.standoutStat1).toContain("40");
    expect(slots.keyPlay1).toContain("Clutch");
  });

  it("swaps winner when away leads", () => {
    const slots = buildStorySlots(
      { ...baseInput, homeScore: 90, awayScore: 100 },
      baseResult,
    );
    expect(slots.winner).toBe("Away");
  });
});

describe("fillTemplate", () => {
  const slots = buildStorySlots(baseInput, baseResult);
  const types: NarrativeType[] = [
    "comeback",
    "dominant",
    "blowout",
    "back-and-forth",
    "defensive",
  ];

  it("dispatches each narrative template", () => {
    for (const t of types) {
      const filled = fillTemplate(slots, t);
      expect(filled.systemPrompt.length).toBeGreaterThan(50);
      expect(filled.userPrompt).toContain("Home");
      expect(filled.userPrompt).toContain("110");
    }
  });
});

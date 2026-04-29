import { describe, it, expect } from "vitest";
import type { BoxScoreInput, SalientEvent } from "@/lib/salient-events";
import {
  extractStoryNumbers,
  buildNumericWhitelist,
  verifyStoryNumerics,
} from "@/lib/story-numeric-verifier";

const box: BoxScoreInput = {
  sport: "NBA",
  homeTeam: "H",
  awayTeam: "A",
  homeScore: 102,
  awayScore: 98,
};

const events: SalientEvent[] = [
  {
    type: "key-play",
    description: "Run extended to 14 points in the third.",
    impactWeight: 80,
    metadata: { pace: 7.5 },
  },
];

describe("story-numeric-verifier", () => {
  it("extracts deduped numbers from text", () => {
    expect(extractStoryNumbers("Scores 12 and 12 and 3.5")).toEqual([12, 3.5]);
  });

  it("builds whitelist from box score and events", () => {
    const w = buildNumericWhitelist(box, events);
    expect(w.has(102)).toBe(true);
    expect(w.has(98)).toBe(true);
    expect(w.has(14)).toBe(true);
    expect(w.has(7.5)).toBe(true);
  });

  it("verifies story numbers against whitelist", () => {
    const ok = verifyStoryNumerics(
      "The home side finished at 102 while the visitors had 98.",
      box,
      events,
    );
    expect(ok.valid).toBe(true);
    expect(ok.whitelistSize).toBeGreaterThan(3);

    const bad = verifyStoryNumerics("Mystery stat 9999 appeared.", box, events);
    expect(bad.valid).toBe(false);
    expect(bad.rejectedNumbers).toContain(9999);
  });
});

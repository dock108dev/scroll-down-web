import { describe, expect, it } from "vitest";
import {
  inningZone,
  leverageBand,
  leverageWeightMap,
  NARRATIVE_REVEAL_DUR_MS,
  NARRATIVE_SETTLE_BONUS_MS,
  NARRATIVE_TYPOGRAPHY_CLASS,
} from "@/lib/leverage";

/**
 * `computeLeverage` was deleted in Phase 5 — leverage tier is decided
 * server-side and arrives on `card.leverageTier`. This file now covers
 * only the pure presentation helpers that survive on the frontend.
 */

describe("inningZone", () => {
  it("buckets innings 1–3 as early", () => {
    expect(inningZone(1)).toBe("early");
    expect(inningZone(2)).toBe("early");
    expect(inningZone(3)).toBe("early");
  });
  it("buckets innings 4–6 as middle", () => {
    expect(inningZone(4)).toBe("middle");
    expect(inningZone(6)).toBe("middle");
  });
  it("buckets innings 7–9 as late", () => {
    expect(inningZone(7)).toBe("late");
    expect(inningZone(9)).toBe("late");
  });
  it("buckets innings 10+ as extra", () => {
    expect(inningZone(10)).toBe("extra");
    expect(inningZone(13)).toBe("extra");
  });
});

describe("leverageBand", () => {
  it("returns low for innings 1–3 regardless of margin", () => {
    expect(leverageBand(1, 0)).toBe("low");
    expect(leverageBand(3, 9)).toBe("low");
  });
  it("returns medium for innings 4–6", () => {
    expect(leverageBand(4, 0)).toBe("medium");
    expect(leverageBand(6, 9)).toBe("medium");
  });
  it("returns medium for late lopsided games (margin >= 5)", () => {
    expect(leverageBand(7, 5)).toBe("medium");
    expect(leverageBand(9, 8)).toBe("medium");
  });
  it("returns high for late innings with margin 2-4", () => {
    expect(leverageBand(7, 2)).toBe("high");
    expect(leverageBand(8, 4)).toBe("high");
    expect(leverageBand(9, 3)).toBe("high");
  });
  it("returns critical for 7th+ within 1 run", () => {
    expect(leverageBand(7, 0)).toBe("critical");
    expect(leverageBand(8, 1)).toBe("critical");
  });
  it("returns critical for 9th+ within 2 runs", () => {
    expect(leverageBand(9, 2)).toBe("critical");
    expect(leverageBand(10, 0)).toBe("critical");
    expect(leverageBand(11, 2)).toBe("critical");
  });
});

describe("leverageWeightMap", () => {
  it("scales 0 → 1 across the four bands", () => {
    expect(leverageWeightMap.low).toBe(0);
    expect(leverageWeightMap.medium).toBeGreaterThan(leverageWeightMap.low);
    expect(leverageWeightMap.high).toBeGreaterThan(leverageWeightMap.medium);
    expect(leverageWeightMap.critical).toBe(1);
  });
});

describe("narrative pacing constants", () => {
  it("settle bonus increases monotonically across tiers", () => {
    expect(NARRATIVE_SETTLE_BONUS_MS[0]).toBe(0);
    expect(NARRATIVE_SETTLE_BONUS_MS[1]).toBe(400);
    expect(NARRATIVE_SETTLE_BONUS_MS[2]).toBe(900);
  });

  it("reveal duration increases monotonically across tiers", () => {
    expect(NARRATIVE_REVEAL_DUR_MS[0]).toBe(200);
    expect(NARRATIVE_REVEAL_DUR_MS[1]).toBe(380);
    expect(NARRATIVE_REVEAL_DUR_MS[2]).toBe(600);
  });

  it("typography class includes the expected weight + size token per tier", () => {
    expect(NARRATIVE_TYPOGRAPHY_CLASS[0]).toContain("font-normal");
    expect(NARRATIVE_TYPOGRAPHY_CLASS[1]).toContain("font-medium");
    expect(NARRATIVE_TYPOGRAPHY_CLASS[2]).toContain("font-semibold");
    expect(NARRATIVE_TYPOGRAPHY_CLASS[2]).toContain("text-xl");
  });
});

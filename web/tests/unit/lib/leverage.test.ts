import { describe, expect, it } from "vitest";
import {
  computeLeverage,
  inningZone,
  leverageBand,
  leverageWeightMap,
  NARRATIVE_REVEAL_DUR_MS,
  NARRATIVE_SETTLE_BONUS_MS,
  NARRATIVE_TYPOGRAPHY_CLASS,
} from "@/lib/leverage";
import type { PlayCardData } from "@/lib/types";

function buildCard(overrides: {
  inning?: number;
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };
  outs?: number;
  bases?: { first: boolean; second: boolean; third: boolean };
} = {}): PlayCardData {
  const before = overrides.scoreBefore ?? { home: 0, away: 0 };
  const after = overrides.scoreAfter ?? before;
  return {
    kind: "play",
    gameId: 1,
    cardId: "c1",
    index: 1,
    playIndex: 1,
    inning: overrides.inning ?? 2,
    inningHalf: "top",
    inningLabel: "Top 2nd",
    description: "",
    scoreBefore: before,
    scoreAfter: after,
    situationBefore: {
      outs: overrides.outs ?? 0,
      baseState: overrides.bases ?? { first: false, second: false, third: false },
    },
    outsAfter: (overrides.outs ?? 0),
    baseStateAfter: { first: false, second: false, third: false },
  };
}

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

describe("computeLeverage", () => {
  it("returns tier 0 for a 2nd-inning routine grounder with no runners", () => {
    const card = buildCard({
      inning: 2,
      scoreBefore: { home: 4, away: 0 },
      scoreAfter: { home: 4, away: 0 },
      outs: 0,
    });
    expect(computeLeverage(card)).toBe(0);
  });

  it("returns tier 0 for a 5th-inning grounder in a blowout", () => {
    const card = buildCard({
      inning: 5,
      scoreBefore: { home: 8, away: 1 },
      scoreAfter: { home: 8, away: 1 },
    });
    expect(computeLeverage(card)).toBe(0);
  });

  it("returns tier 1 for a 6th-inning walk in a tied game", () => {
    const card = buildCard({
      inning: 6,
      scoreBefore: { home: 3, away: 3 },
      scoreAfter: { home: 3, away: 3 },
    });
    expect(computeLeverage(card)).toBe(1);
  });

  it("returns tier 1 for a 7th-inning 2-run double that ties (no lead flip)", () => {
    const card = buildCard({
      inning: 7,
      scoreBefore: { home: 2, away: 0 },
      scoreAfter: { home: 2, away: 2 },
    });
    expect(computeLeverage(card)).toBe(1);
  });

  it("escalates to tier 2 when the 2-run hit also flips the lead", () => {
    const card = buildCard({
      inning: 7,
      scoreBefore: { home: 2, away: 1 },
      scoreAfter: { home: 2, away: 3 },
    });
    expect(computeLeverage(card)).toBe(2);
  });

  it("returns tier 2 for an 8th-inning RBI single, 1-run game, 2 outs, bases loaded", () => {
    const card = buildCard({
      inning: 8,
      scoreBefore: { home: 2, away: 1 },
      scoreAfter: { home: 2, away: 2 },
      outs: 2,
      bases: { first: true, second: true, third: true },
    });
    expect(computeLeverage(card)).toBe(2);
  });

  it("returns tier 2 for a 9th-inning walk-off RBI single (lead flip)", () => {
    const card = buildCard({
      inning: 9,
      scoreBefore: { home: 2, away: 3 },
      scoreAfter: { home: 4, away: 3 },
      outs: 2,
      bases: { first: false, second: false, third: true },
    });
    expect(computeLeverage(card)).toBe(2);
  });

  it("ignores upstream runs when scoreBefore is identical to scoreAfter", () => {
    const card = buildCard({
      inning: 9,
      scoreBefore: { home: 0, away: 0 },
      scoreAfter: { home: 0, away: 0 },
    });
    expect(computeLeverage(card)).toBe(1);
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

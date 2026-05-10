import { describe, expect, it } from "vitest";
import { resultChipTier } from "@/lib/result-chip";
import type { BaseballBaseState, PlayCardData } from "@/lib/types";

/**
 * Phase 5: `primaryFor`, `secondaryFor`, and `resultChipLabel` were
 * deleted from `lib/result-chip.ts` — chip text comes from the backend
 * (`card.chipPrimary` / `card.chipSecondary`). This file now only covers
 * the surviving presentation classifier `resultChipTier`.
 */

const EMPTY_BASES: BaseballBaseState = { first: false, second: false, third: false };


function buildCard(overrides: {
  chipPrimary?: string;
  chipSecondary?: string;
  inning?: number;
  inningHalf?: "top" | "bottom";
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };
  outs?: number;
  bases?: BaseballBaseState;
} = {}): PlayCardData {
  const before = overrides.scoreBefore ?? { home: 0, away: 0 };
  const after = overrides.scoreAfter ?? before;
  return {
    kind: "play",
    gameId: 1,
    cardId: "c1",
    index: 1,
    playIndex: 1,
    inning: overrides.inning ?? 3,
    inningHalf: overrides.inningHalf ?? "top",
    inningLabel: "Top 3rd",
    description: "",
    scoreBefore: before,
    scoreAfter: after,
    situationBefore: {
      outs: overrides.outs ?? 0,
      baseState: overrides.bases ?? EMPTY_BASES,
    },
    outsAfter: overrides.outs ?? 0,
    baseStateAfter: EMPTY_BASES,
    chipPrimary: overrides.chipPrimary,
    chipSecondary: overrides.chipSecondary,
  };
}

describe("resultChipTier — base tiering by primary label", () => {
  it("returns tier 3 for a HOME RUN", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "HOME RUN" }))).toBe(3);
  });
  it("returns tier 3 for a GRAND SLAM", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "GRAND SLAM" }))).toBe(3);
  });
  it("returns tier 3 for an INSIDE-THE-PARK HOME RUN", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "INSIDE-THE-PARK HOME RUN" }))).toBe(3);
  });
  it("returns tier 3 for a TRIPLE PLAY", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "TRIPLE PLAY" }))).toBe(3);
  });
  it("returns tier 2 for a DOUBLE", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "DOUBLE" }))).toBe(2);
  });
  it("returns tier 2 for a TRIPLE", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "TRIPLE" }))).toBe(2);
  });
  it("returns tier 2 for a DOUBLE PLAY", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "DOUBLE PLAY" }))).toBe(2);
  });
  it("returns tier 0 for routine outs and walks", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "GROUNDOUT" }))).toBe(0);
    expect(resultChipTier(buildCard({ chipPrimary: "FLYOUT" }))).toBe(0);
    expect(resultChipTier(buildCard({ chipPrimary: "STRIKEOUT" }))).toBe(0);
    expect(resultChipTier(buildCard({ chipPrimary: "WALK" }))).toBe(0);
    expect(resultChipTier(buildCard({ chipPrimary: "HIT BY PITCH" }))).toBe(0);
  });
  it("returns tier 1 for a generic SINGLE without leverage context", () => {
    expect(resultChipTier(buildCard({ chipPrimary: "SINGLE" }))).toBe(1);
  });
});

describe("resultChipTier — secondary boosts", () => {
  it("RUN SCORES bumps a SINGLE to tier 2", () => {
    expect(
      resultChipTier(
        buildCard({
          chipPrimary: "SINGLE",
          chipSecondary: "RUN SCORES",
        }),
      ),
    ).toBe(2);
  });
  it("+2 RUNS bumps a SINGLE to tier 3", () => {
    expect(
      resultChipTier(
        buildCard({
          chipPrimary: "SINGLE",
          chipSecondary: "+2 RUNS",
          scoreBefore: { home: 0, away: 0 },
          scoreAfter: { home: 2, away: 0 },
          inningHalf: "bottom",
        }),
      ),
    ).toBe(3);
  });
  it("INNING OVER bumps a routine FORCE OUT to tier 2", () => {
    expect(
      resultChipTier(
        buildCard({
          chipPrimary: "FORCE OUT",
          chipSecondary: "INNING OVER",
        }),
      ),
    ).toBe(2);
  });
});

describe("resultChipTier — leverage amplifier", () => {
  it("walk-off setup boosts SINGLE from tier 1 to tier 2", () => {
    const card = buildCard({
      chipPrimary: "SINGLE",
      inning: 9,
      inningHalf: "bottom",
      scoreBefore: { home: 1, away: 2 },
      scoreAfter: { home: 1, away: 2 },
    });
    expect(resultChipTier(card)).toBe(2);
  });

  it("late + close + 2-out boosts SINGLE to tier 2", () => {
    const card = buildCard({
      chipPrimary: "SINGLE",
      inning: 8,
      scoreBefore: { home: 2, away: 1 },
      scoreAfter: { home: 2, away: 1 },
      outs: 2,
    });
    expect(resultChipTier(card)).toBe(2);
  });

  it("tier 0 routines stay tier 0 even in late close games", () => {
    const card = buildCard({
      chipPrimary: "GROUNDOUT",
      inning: 9,
      scoreBefore: { home: 1, away: 0 },
      scoreAfter: { home: 1, away: 0 },
    });
    expect(resultChipTier(card)).toBe(0);
  });
});

describe("resultChipTier — fallback", () => {
  it("falls back to the tier-0 'PLAY' primary when chipPrimary is missing", () => {
    // The function uses "PLAY" as the implicit chip text, which is in
    // TIER_ZERO_PRIMARIES — so the fallback tier is 0 (visually quiet),
    // matching the previous behavior when neither primary nor secondary
    // was identifiable.
    expect(resultChipTier(buildCard({}))).toBe(0);
  });
});

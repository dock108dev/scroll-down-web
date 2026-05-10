import { describe, expect, it } from "vitest";
import { computeStageSetter } from "@/lib/stage-setter";
import type { PlayCardData } from "@/lib/types";

function play(overrides: Partial<PlayCardData> = {}): PlayCardData {
  return {
    kind: "play",
    gameId: 1,
    cardId: `p-${overrides.playIndex ?? 1}`,
    index: overrides.playIndex ?? 1,
    playIndex: overrides.playIndex ?? 1,
    inning: 1,
    inningHalf: "top",
    inningLabel: "Top 1st",
    description: "",
    scoreBefore: { home: 0, away: 0 },
    scoreAfter: { home: 0, away: 0 },
    situationBefore: {
      baseState: { first: false, second: false, third: false },
    },
    outsAfter: 0,
    baseStateAfter: { first: false, second: false, third: false },
    leverageTier: 0,
    ...overrides,
  };
}

describe("computeStageSetter", () => {
  it("returns null when there is no previous card", () => {
    expect(computeStageSetter(play(), undefined)).toBeNull();
  });

  it("returns null for consecutive same-half batters with no special leverage", () => {
    const prev = play({ playIndex: 1001 });
    const curr = play({ playIndex: 1002 });
    expect(computeStageSetter(curr, prev)).toBeNull();
  });

  it("announces a skipped batter", () => {
    const prev = play({ playIndex: 1001 });
    const curr = play({ playIndex: 1003 });
    expect(computeStageSetter(curr, prev)).toBe("1 BATTER LATER");
  });

  it("announces multiple skipped batters", () => {
    const prev = play({ playIndex: 1001 });
    const curr = play({ playIndex: 1006 });
    expect(computeStageSetter(curr, prev)).toBe("4 BATTERS LATER");
  });

  it("announces a half-inning flip", () => {
    const prev = play({ inning: 5, inningHalf: "top", playIndex: 5001 });
    const curr = play({ inning: 5, inningHalf: "bottom", playIndex: 5501, inningLabel: "Bottom 5th" });
    expect(computeStageSetter(curr, prev)).toBe("BOTTOM 5TH");
  });

  it("uses the inning label on an inning crossing", () => {
    const prev = play({ inning: 4, inningHalf: "bottom", playIndex: 4502 });
    const curr = play({ inning: 5, inningHalf: "top", playIndex: 5001, inningLabel: "Top 5th" });
    expect(computeStageSetter(curr, prev)).toBe("TOP 5TH");
  });

  it("adds a stakes line on tier-2 cards with bases loaded and batting team behind", () => {
    const prev = play({ inning: 7, inningHalf: "top", playIndex: 7001 });
    const curr = play({
      inning: 7,
      inningHalf: "top",
      inningLabel: "Top 7th",
      playIndex: 7004,
      leverageTier: 2,
      scoreBefore: { home: 5, away: 2 },
      situationBefore: {
        baseState: { first: true, second: true, third: true },
        outs: 2,
      },
    });
    expect(computeStageSetter(curr, prev)).toBe(
      "2 BATTERS LATER · BASES LOADED · DOWN 3",
    );
  });

  it("frames a tie game distinctly from a margin", () => {
    const prev = play({ inning: 9, inningHalf: "top", playIndex: 9001 });
    const curr = play({
      inning: 9,
      inningHalf: "top",
      playIndex: 9002,
      leverageTier: 2,
      scoreBefore: { home: 4, away: 4 },
      situationBefore: {
        baseState: { first: false, second: true, third: false },
        outs: 1,
      },
    });
    // Same-batter consecutive in same half — transition is null, only stakes shown.
    expect(computeStageSetter(curr, prev)).toBe(
      "RUNNER IN SCORING POSITION · TIE GAME",
    );
  });

  it("scores the batting team's margin from their perspective on the bottom half", () => {
    const prev = play({ inning: 9, inningHalf: "bottom", playIndex: 9501 });
    const curr = play({
      inning: 9,
      inningHalf: "bottom",
      playIndex: 9502,
      leverageTier: 2,
      scoreBefore: { home: 1, away: 4 }, // home (batting) down 3
      situationBefore: {
        baseState: { first: false, second: false, third: false },
        outs: 2,
      },
    });
    expect(computeStageSetter(curr, prev)).toBe("DOWN 3");
  });

  it("does not add a stakes line for routine leverage tiers", () => {
    const prev = play({ playIndex: 5001 });
    const curr = play({
      playIndex: 5004,
      leverageTier: 1, // not climactic
      situationBefore: {
        baseState: { first: true, second: true, third: true },
        outs: 2,
      },
    });
    // Stakes string suppressed at tier 1 — only the transition shows.
    expect(computeStageSetter(curr, prev)).toBe("2 BATTERS LATER");
  });
});

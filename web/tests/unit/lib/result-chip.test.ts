import { describe, expect, it } from "vitest";
import { resultChipLabel, resultChipTier } from "@/lib/result-chip";
import type {
  BaseballBaseState,
  PlayCardData,
  PlayEventType,
  RunnerAdvance,
} from "@/lib/types";

const EMPTY_BASES: BaseballBaseState = { first: false, second: false, third: false };

function buildCard(overrides: Partial<PlayCardData> & {
  eventType?: PlayEventType;
  description?: string;
  outs?: number;
  bases?: BaseballBaseState;
  runnerAdvances?: RunnerAdvance[];
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
    inningLabel: overrides.inningLabel ?? "Top 3rd",
    description: overrides.description ?? "",
    eventType: overrides.eventType ?? "field_out",
    scoreBefore: before,
    scoreAfter: after,
    situationBefore: {
      outs: overrides.outs ?? 0,
      baseState: overrides.bases ?? EMPTY_BASES,
    },
    outsAfter: overrides.outsAfter ?? (overrides.outs ?? 0),
    baseStateAfter: overrides.baseStateAfter ?? EMPTY_BASES,
    runnerAdvances: overrides.runnerAdvances,
  };
}

describe("resultChipTier — base tiering by primary label", () => {
  it("returns tier 3 for a HOME RUN", () => {
    const card = buildCard({
      eventType: "home_run",
      description: "Aaron Judge homers (24) on a fly ball to deep left.",
    });
    expect(resultChipLabel(card).primary).toBe("HOME RUN");
    expect(resultChipTier(card)).toBe(3);
  });

  it("returns tier 3 for a GRAND SLAM (even in a blowout — amplifier-exempt at cap)", () => {
    const card = buildCard({
      eventType: "home_run",
      description: "Aaron Judge hits a grand slam to right.",
      inning: 6,
      scoreBefore: { home: 1, away: 9 },
      scoreAfter: { home: 1, away: 13 },
    });
    expect(resultChipLabel(card).primary).toBe("GRAND SLAM");
    expect(resultChipTier(card)).toBe(3);
  });

  it("returns tier 3 for a TRIPLE PLAY", () => {
    expect(resultChipTier(buildCard({ eventType: "triple_play", outsAfter: 3 }))).toBe(3);
  });

  it("returns tier 2 for a DOUBLE", () => {
    expect(resultChipTier(buildCard({ eventType: "double" }))).toBe(2);
  });

  it("returns tier 2 for a DOUBLE PLAY", () => {
    expect(resultChipTier(buildCard({ eventType: "double_play", outs: 0, outsAfter: 2 }))).toBe(2);
  });

  it("returns tier 1 for a SINGLE with no run-scoring", () => {
    expect(resultChipTier(buildCard({ eventType: "single" }))).toBe(1);
  });

  it("returns tier 0 for a routine GROUNDOUT", () => {
    const card = buildCard({
      eventType: "field_out",
      description: "Mike Trout grounds out, shortstop to first.",
      outs: 0,
      outsAfter: 1,
    });
    expect(resultChipLabel(card).primary).toBe("GROUNDOUT");
    expect(resultChipTier(card)).toBe(0);
  });

  it("returns tier 0 for a WALK", () => {
    expect(resultChipTier(buildCard({ eventType: "walk" }))).toBe(0);
  });

  it("returns tier 0 for a STRIKEOUT (default flavor)", () => {
    expect(resultChipTier(buildCard({ eventType: "strikeout", outsAfter: 1 }))).toBe(0);
  });

  it("returns tier 0 for HIT BY PITCH", () => {
    expect(resultChipTier(buildCard({ eventType: "hit_by_pitch" }))).toBe(0);
  });
});

describe("resultChipTier — secondary-driven tiering", () => {
  it("escalates to tier 2 when a single drives in a run", () => {
    const card = buildCard({
      eventType: "single",
      description: "Soto singles, run scores.",
      scoreBefore: { home: 1, away: 0 },
      scoreAfter: { home: 1, away: 1 },
      runnerAdvances: [
        { from: "third", to: "home" },
        { from: "home", to: "first" },
      ],
    });
    expect(resultChipLabel(card).secondary).toBe("RUN SCORES");
    expect(resultChipTier(card)).toBe(2);
  });

  it("returns tier 3 when secondary is +2 RUNS", () => {
    const card = buildCard({
      eventType: "double",
      description: "Two-run double down the line.",
      scoreBefore: { home: 0, away: 0 },
      scoreAfter: { home: 0, away: 2 },
      runnerAdvances: [
        { from: "second", to: "home" },
        { from: "first", to: "home" },
        { from: "home", to: "second" },
      ],
    });
    expect(resultChipLabel(card).secondary).toBe("+2 RUNS");
    expect(resultChipTier(card)).toBe(3);
  });

  it("returns tier 2 when the inning ends on a routine flyout", () => {
    const card = buildCard({
      eventType: "field_out",
      description: "Routine fly out to center.",
      outs: 2,
      outsAfter: 3,
    });
    expect(resultChipLabel(card).secondary).toBe("INNING OVER");
    expect(resultChipTier(card)).toBe(2);
  });
});

describe("resultChipTier — leverage amplifiers", () => {
  it("boosts a walk-off RBI single (bottom 9th, RUN SCORES) to tier 3", () => {
    const card = buildCard({
      eventType: "single",
      description: "Walk-off single up the middle.",
      inning: 9,
      inningHalf: "bottom",
      scoreBefore: { home: 3, away: 4 },
      scoreAfter: { home: 5, away: 4 },
      bases: { first: false, second: true, third: true },
      runnerAdvances: [
        { from: "third", to: "home" },
        { from: "second", to: "home" },
        { from: "home", to: "first" },
      ],
    });
    expect(resultChipLabel(card).secondary).toBe("+2 RUNS");
    expect(resultChipTier(card)).toBe(3);
  });

  it("boosts an 8th-inning bases-loaded 2-out single to tier 3", () => {
    const card = buildCard({
      eventType: "single",
      description: "Two-out RBI single, bases loaded.",
      inning: 8,
      inningHalf: "top",
      scoreBefore: { home: 2, away: 1 },
      scoreAfter: { home: 2, away: 2 },
      outs: 2,
      outsAfter: 2,
      bases: { first: true, second: true, third: true },
      runnerAdvances: [
        { from: "third", to: "home" },
        { from: "second", to: "third" },
        { from: "first", to: "second" },
        { from: "home", to: "first" },
      ],
    });
    expect(resultChipLabel(card).secondary).toBe("RUN SCORES");
    expect(resultChipTier(card)).toBe(3);
  });

  it("does NOT boost a routine groundout in a walk-off situation (tier 0 amplifier-exempt)", () => {
    const card = buildCard({
      eventType: "field_out",
      description: "Grounds out, shortstop to first.",
      inning: 9,
      inningHalf: "bottom",
      scoreBefore: { home: 2, away: 3 },
      scoreAfter: { home: 2, away: 3 },
      outs: 1,
      outsAfter: 2,
      bases: { first: true, second: true, third: true },
    });
    expect(resultChipLabel(card).primary).toBe("GROUNDOUT");
    expect(resultChipTier(card)).toBe(0);
  });

  it("does NOT exceed tier 3 — grand slam in walk-off situation stays at 3", () => {
    const card = buildCard({
      eventType: "home_run",
      description: "Walk-off grand slam!",
      inning: 9,
      inningHalf: "bottom",
      scoreBefore: { home: 0, away: 1 },
      scoreAfter: { home: 4, away: 1 },
      bases: { first: true, second: true, third: true },
    });
    expect(resultChipTier(card)).toBe(3);
  });

  it("does not boost when situationBefore.baseState is empty and game is not late/close", () => {
    const card = buildCard({
      eventType: "single",
      inning: 3,
      scoreBefore: { home: 0, away: 0 },
      scoreAfter: { home: 0, away: 0 },
    });
    expect(resultChipTier(card)).toBe(1);
  });
});

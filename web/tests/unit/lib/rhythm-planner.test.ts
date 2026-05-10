import { describe, expect, it } from "vitest";
import { planDeck, summarizeHalfInnings } from "@/lib/rhythm-planner";
import type {
  PlayCardData,
  SceneSetterCard,
} from "@/lib/types";

const SCENE: SceneSetterCard = {
  kind: "scene-setter",
  gameId: 1,
  cardId: "1-scene",
  index: 0,
  homeTeam: "Yankees",
  awayTeam: "Red Sox",
  homeTeamAbbr: "NYY",
  awayTeamAbbr: "BOS",
  firstPitch: "2026-04-01T19:05:00-04:00",
  homeProbablePitcher: null,
  awayProbablePitcher: null,
  venue: null,
};

function play(opts: {
  playIndex: number;
  inning: number;
  half: "top" | "bottom";
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };
  outsAfter?: number;
}): PlayCardData {
  const before = opts.scoreBefore ?? { home: 0, away: 0 };
  const after = opts.scoreAfter ?? before;
  return {
    kind: "play",
    gameId: 1,
    cardId: `1-${opts.playIndex}`,
    index: 0,
    playIndex: opts.playIndex,
    inning: opts.inning,
    inningHalf: opts.half,
    inningLabel: `${opts.half === "top" ? "Top" : "Bottom"} ${opts.inning}`,
    description: "play",
    scoreBefore: before,
    scoreAfter: after,
    situationBefore: { baseState: { first: false, second: false, third: false } },
    outsAfter: opts.outsAfter ?? 1,
    baseStateAfter: { first: false, second: false, third: false },
    runnerNamesBefore: {},
    runnerNamesAfter: {},
  };
}

describe("rhythm-planner: scene setter", () => {
  it("places the scene setter at index 0 when present", () => {
    const deck = planDeck({
      scene: SCENE,
      playCards: [play({ playIndex: 1, inning: 1, half: "top" })],
      halfInningMeta: new Map(),
      homeTeamAbbr: "NYY",
      awayTeamAbbr: "BOS",
    });
    expect(deck[0].kind).toBe("scene-setter");
    expect(deck[0].index).toBe(0);
  });

  it("omits the scene setter on incremental fetches", () => {
    const deck = planDeck({
      scene: null,
      playCards: [play({ playIndex: 1, inning: 1, half: "top" })],
      halfInningMeta: new Map(),
      homeTeamAbbr: "NYY",
      awayTeamAbbr: "BOS",
    });
    expect(deck[0].kind).toBe("play");
  });
});

describe("rhythm-planner: inning-transition meaningfulness rule", () => {
  it("inserts a transition when the previous half scored 2+ runs", () => {
    const a = play({
      playIndex: 1, inning: 3, half: "top",
      scoreBefore: { home: 0, away: 0 }, scoreAfter: { home: 0, away: 2 },
    });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 2, isLeadChangePlay: false, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeDefined();
  });

  it("suppresses the transition when the previous half scored only 1 run with no leverage", () => {
    const a = play({
      playIndex: 1, inning: 3, half: "top",
      scoreBefore: { home: 0, away: 0 }, scoreAfter: { home: 0, away: 1 },
    });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 1, isLeadChangePlay: false, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeUndefined();
  });

  it("inserts a transition for a 1-run half if it changed the lead", () => {
    const a = play({
      playIndex: 1, inning: 3, half: "top",
      scoreBefore: { home: 1, away: 0 }, scoreAfter: { home: 1, away: 2 },
    });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 1, isLeadChangePlay: true, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeDefined();
  });

  it("inserts a transition for a 1-run half if it tied the game", () => {
    const a = play({
      playIndex: 1, inning: 3, half: "top",
      scoreBefore: { home: 1, away: 0 }, scoreAfter: { home: 1, away: 1 },
    });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 1, isLeadChangePlay: false, isTyingPlay: true },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeDefined();
  });

  it("inserts a transition for a 1-run half in the late innings (7+)", () => {
    const a = play({
      playIndex: 1, inning: 8, half: "top",
      scoreBefore: { home: 2, away: 0 }, scoreAfter: { home: 2, away: 1 },
    });
    const b = play({ playIndex: 2, inning: 8, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 8, half: "top", runsScored: 1, isLeadChangePlay: false, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeDefined();
  });

  it("suppresses transition when the previous half scored 0 runs", () => {
    const a = play({ playIndex: 1, inning: 3, half: "top" });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 0, isLeadChangePlay: false, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "inning-transition")).toBeUndefined();
  });
});

describe("rhythm-planner: quiet-stretch rule", () => {
  it("compresses 3+ silent half-innings into a single quiet-stretch card", () => {
    const a = play({ playIndex: 1, inning: 1, half: "top" });
    const b = play({ playIndex: 2, inning: 4, half: "bottom" });
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    const qs = deck.filter((c) => c.kind === "quiet-stretch");
    expect(qs.length).toBe(1);
    // No transition should also fire — the quiet-stretch supplants it.
    expect(deck.find((c) => c.kind === "inning-transition")).toBeUndefined();
  });
});

describe("rhythm-planner: late-game rule", () => {
  it("inserts a late-game card the first time we cross into 7th+ in a close game", () => {
    const a = play({
      playIndex: 1, inning: 6, half: "bottom",
      scoreBefore: { home: 1, away: 1 }, scoreAfter: { home: 1, away: 1 },
    });
    const b = play({
      playIndex: 2, inning: 7, half: "top",
      scoreBefore: { home: 1, away: 1 },
    });
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    const lg = deck.filter((c) => c.kind === "late-game");
    expect(lg.length).toBe(1);
  });

  it("does NOT insert a late-game card when the game is already a blowout", () => {
    const a = play({
      playIndex: 1, inning: 6, half: "bottom",
      scoreBefore: { home: 0, away: 8 }, scoreAfter: { home: 0, away: 8 },
    });
    const b = play({
      playIndex: 2, inning: 7, half: "top",
      scoreBefore: { home: 0, away: 8 },
    });
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "late-game")).toBeUndefined();
  });

  it("only fires the late-game beat once, even when crossing 7th boundary repeatedly", () => {
    const a = play({
      playIndex: 1, inning: 6, half: "bottom",
      scoreBefore: { home: 1, away: 1 }, scoreAfter: { home: 1, away: 1 },
    });
    const b = play({
      playIndex: 2, inning: 7, half: "top",
      scoreBefore: { home: 1, away: 1 },
    });
    const c = play({
      playIndex: 3, inning: 7, half: "bottom",
      scoreBefore: { home: 1, away: 1 },
    });
    const deck = planDeck({
      scene: null, playCards: [a, b, c], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.filter((c) => c.kind === "late-game").length).toBe(1);
  });
});

describe("rhythm-planner: final-setup rule", () => {
  it("inserts a final-setup card before the last play in a close 9th", () => {
    const a = play({
      playIndex: 1, inning: 9, half: "bottom",
      scoreBefore: { home: 1, away: 2 },
    });
    const deck = planDeck({
      scene: null, playCards: [a], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    const fs = deck.find((c) => c.kind === "final-setup");
    expect(fs).toBeDefined();
    // Final setup MUST come before the play card.
    const fsIdx = deck.findIndex((c) => c.kind === "final-setup");
    const playIdx = deck.findIndex((c) => c.kind === "play");
    expect(fsIdx).toBeLessThan(playIdx);
  });

  it("does NOT insert a final-setup when the game is a blowout", () => {
    const a = play({
      playIndex: 1, inning: 9, half: "bottom",
      scoreBefore: { home: 1, away: 9 },
    });
    const deck = planDeck({
      scene: null, playCards: [a], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    expect(deck.find((c) => c.kind === "final-setup")).toBeUndefined();
  });
});

describe("rhythm-planner: priorAfter attachment", () => {
  it("attaches priorAfter when no rhythm card sits between two plays", () => {
    const a = play({ playIndex: 1, inning: 3, half: "top" });
    const b = play({ playIndex: 2, inning: 3, half: "top" });
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: new Map(),
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    const second = deck.find((c) => c.kind === "play" && c.playIndex === 2);
    if (second?.kind !== "play") throw new Error("expected play card");
    expect(second.priorAfter).toBeDefined();
  });

  it("clears priorAfter when a rhythm card sits between two plays", () => {
    const a = play({
      playIndex: 1, inning: 3, half: "top",
      scoreAfter: { home: 0, away: 2 },
    });
    const b = play({ playIndex: 2, inning: 3, half: "bottom" });
    const meta = summarizeHalfInnings([
      { inning: 3, half: "top", runsScored: 2, isLeadChangePlay: false, isTyingPlay: false },
    ]);
    const deck = planDeck({
      scene: null, playCards: [a, b], halfInningMeta: meta,
      homeTeamAbbr: "NYY", awayTeamAbbr: "BOS",
    });
    const second = deck.find((c) => c.kind === "play" && c.playIndex === 2);
    if (second?.kind !== "play") throw new Error("expected play card");
    expect(second.priorAfter).toBeUndefined();
  });
});

describe("rhythm-planner: indices are sequential", () => {
  it("issues a strictly increasing index across the full deck", () => {
    const deck = planDeck({
      scene: SCENE,
      playCards: [
        play({ playIndex: 1, inning: 1, half: "top" }),
        play({ playIndex: 2, inning: 4, half: "top" }), // gap → quiet-stretch
        play({ playIndex: 3, inning: 4, half: "top" }),
      ],
      halfInningMeta: new Map(),
      homeTeamAbbr: "NYY",
      awayTeamAbbr: "BOS",
    });
    for (let i = 0; i < deck.length; i++) {
      expect(deck[i].index).toBe(i);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCatchupCards,
  computeBatterTimeline,
  computePitcherTimeline,
  computeTimeline,
  formatOutsAsIP,
  humanizeDescription,
  parseDescriptionAdvances,
  sampleTier2,
} from "@/lib/catchup-cards";
import { CATCHUP } from "@/lib/config";
import type { PlayEntry } from "@/lib/types";

function play(playIndex: number, tier: number, overrides: Partial<PlayEntry> = {}): PlayEntry {
  return {
    playIndex,
    tier,
    description: `play ${playIndex}`,
    quarter: Math.floor(playIndex / 4) + 1,
    phase: playIndex % 2 === 0 ? "top" : "bottom",
    homeScoreBefore: 0,
    awayScoreBefore: 0,
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  };
}

const SCENE_INPUT = {
  game: {
    id: 12345,
    homeTeam: "Red Sox",
    awayTeam: "Yankees",
    homeTeamAbbr: "BOS",
    awayTeamAbbr: "NYY",
    gameDate: "2025-05-07T19:10:00-04:00",
  },
};

describe("sampleTier2", () => {
  it("returns the whole pool when quota >= length", () => {
    const pool = [play(1, 2), play(2, 2), play(3, 2)];
    expect(sampleTier2(pool, 5, 1)).toEqual(pool);
    expect(sampleTier2(pool, 3, 1)).toEqual(pool);
  });
  it("returns nothing when quota <= 0", () => {
    expect(sampleTier2([play(1, 2)], 0, 1)).toEqual([]);
    expect(sampleTier2([play(1, 2)], -1, 1)).toEqual([]);
  });
  it("is deterministic for the same gameId", () => {
    const pool = Array.from({ length: 30 }, (_, i) => play(i + 100, 2));
    const a = sampleTier2(pool, 10, 12345).map((p) => p.playIndex);
    const b = sampleTier2(pool, 10, 12345).map((p) => p.playIndex);
    expect(a).toEqual(b);
  });
  it("differs for different gameIds", () => {
    const pool = Array.from({ length: 30 }, (_, i) => play(i + 100, 2));
    const a = sampleTier2(pool, 10, 12345).map((p) => p.playIndex);
    const b = sampleTier2(pool, 10, 99999).map((p) => p.playIndex);
    expect(a).not.toEqual(b);
  });
});

describe("buildCatchupCards", () => {
  it("includes every tier 1 play and samples tier 2 with shape-scaled padding", () => {
    // 6 tier-1 plays drive a natural deck. The sampler adds proportional
    // tier-2 padding (~40%, floor 2) — the deck doesn't artificially fill
    // to a flat target regardless of game shape.
    const tier1 = Array.from({ length: 6 }, (_, i) => play(i, 1));
    const tier2 = Array.from({ length: 40 }, (_, i) => play(i + 100, 2));
    const res = buildCatchupCards({
      ...SCENE_INPUT,
      plays: [...tier1, ...tier2],
      isFinal: true,
    });
    const playCards = res.cards.filter((c) => c.kind === "play");
    for (const t1 of tier1) {
      expect(playCards.some((c) => c.kind === "play" && c.playIndex === t1.playIndex)).toBe(true);
    }
    // Must-include count + at least the floor of 2 tier-2 samples; never
    // exceeds HARD_MAX. With 6 tier-1 + 0.4 padding = ~8 total cards.
    expect(playCards.length).toBeGreaterThanOrEqual(tier1.length + 2);
    expect(playCards.length).toBeLessThanOrEqual(CATCHUP.HARD_MAX);
  });

  it("never trims tier 1 even when it exceeds the hard max", () => {
    const tier1 = Array.from({ length: 30 }, (_, i) => play(i, 1));
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: tier1, isFinal: true });
    const playCards = res.cards.filter((c) => c.kind === "play");
    expect(playCards.length).toBe(30);
  });

  it("samples tier 2 within the available supply when quota is small", () => {
    // With 4 tier-1 + 5 tier-2, the new shape-scaled sampler computes
    // a tier-2 quota of ~2 (40% of 4, floor of 2). All sampled plays
    // come from the available tier-2 supply.
    const tier1 = Array.from({ length: 4 }, (_, i) => play(i, 1));
    const tier2 = Array.from({ length: 5 }, (_, i) => play(i + 100, 2));
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [...tier1, ...tier2], isFinal: false });
    const playCards = res.cards.filter((c) => c.kind === "play");
    // Force-includes all present + at least 2 tier-2 sampled.
    expect(playCards.length).toBeGreaterThanOrEqual(tier1.length + 2);
    // Never overshoots into invented samples.
    expect(playCards.length).toBeLessThanOrEqual(tier1.length + tier2.length);
  });

  it("sorts the merged deck by playIndex", () => {
    const plays = [play(50, 1), play(10, 2), play(40, 2), play(20, 1)];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const indices = res.cards
      .filter((c) => c.kind === "play")
      .map((c) => c.kind === "play" && c.playIndex);
    expect(indices).toEqual([...indices].sort((a, b) => Number(a) - Number(b)));
  });

  it("prepends a scene setter on the initial fetch and omits it on `since` polls", () => {
    const plays = [play(1, 1), play(2, 1)];
    const initial = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: false });
    expect(initial.cards[0].kind).toBe("scene-setter");
    const incremental = buildCatchupCards({
      ...SCENE_INPUT,
      plays,
      sincePlayIndex: 1,
      isFinal: false,
    });
    expect(incremental.cards.every((c) => c.kind === "play")).toBe(true);
  });

  it("ships score-before AND score-after so the scoreboard can animate", () => {
    const p = play(1, 1, {
      homeScoreBefore: 1,
      awayScoreBefore: 0,
      homeScore: 3,
      awayScore: 0,
      scoreChanged: true,
      pointsScored: 2,
    });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    expect(card).toBeDefined();
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.scoreBefore).toEqual({ home: 1, away: 0 });
    expect(card.scoreAfter).toEqual({ home: 3, away: 0 });
  });

  it("routes a home run ball path toward the named outfield zone", () => {
    // HR ball paths are now direction-aware so the trail exits OVER the
    // wall toward the actual field (no more single vertical-beam path).
    function buildHrCard(description: string) {
      const p = play(1, 1, { description, teamAbbreviation: "NYY" });
      const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
      const card = res.cards.find((c) => c.kind === "play");
      if (card?.kind !== "play") throw new Error("expected play card");
      return card;
    }
    const left   = buildHrCard("Aaron Judge homers on a fly ball to deep left field.");
    const right  = buildHrCard("Aaron Judge homers on a fly ball to right field.");
    const center = buildHrCard("Aaron Judge homers on a fly ball to center field.");
    expect(left.eventType).toBe("home_run");
    expect(left.ballPath).toBe("home_run_left");
    expect(left.visualIntensity).toBe("high");
    expect(right.ballPath).toBe("home_run_right");
    expect(center.ballPath).toBe("home_run_center");
  });

  it("classifies a strikeout and emits no ball-trail path", () => {
    // The pitch dot still fires (it's gated independently on event type),
    // but a strikeout has no hit ball, so no trail is drawn.
    const p = play(1, 1, { description: "Skenes strikes out the side." });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.eventType).toBe("strikeout");
    expect(card.ballPath).toBe("none");
  });

  it("attaches inning, half, and label", () => {
    const p = play(0, 1, { quarter: 7, phase: "bottom" });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.inning).toBe(7);
    expect(card.inningHalf).toBe("bottom");
    expect(card.inningLabel).toBe("Bottom 7th");
  });

  it("force-advances baserunners on a walk with bases loaded", () => {
    const p = play(1, 1, {
      description: "Walks on a 3-2 pitch.",
      ...({ runnersBefore: ["1B", "2B", "3B"] } as unknown as Partial<PlayEntry>),
    });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.eventType).toBe("walk");
    expect(card.baseStateAfter).toEqual({ first: true, second: true, third: true });
    const advances = card.runnerAdvances ?? [];
    expect(advances.find((a) => a.from === "third")?.to).toBe("home");
    expect(advances.find((a) => a.from === "second")?.to).toBe("third");
    expect(advances.find((a) => a.from === "first")?.to).toBe("second");
    expect(advances.find((a) => a.from === "home")?.to).toBe("first");
  });

  it("clears every base on a home run", () => {
    const p = play(1, 1, {
      description: "Crushed for a home run to right field.",
      ...({ runnersBefore: ["1B", "3B"] } as unknown as Partial<PlayEntry>),
    });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.eventType).toBe("home_run");
    expect(card.baseStateAfter).toEqual({ first: false, second: false, third: false });
  });

  it("computes outs across the FULL play sequence including tier-3 routine outs", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 3, quarter: 1, phase: "top", description: "Grounds out." },
      { playIndex: 2, tier: 3, quarter: 1, phase: "top", description: "Pops out." },
      { playIndex: 3, tier: 3, quarter: 1, phase: "top", description: "Strikes out." },
      { playIndex: 4, tier: 1, quarter: 1, phase: "bottom", description: "Singles to right." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const card = res.cards.find((c) => c.kind === "play" && c.playIndex === 4);
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.situationBefore.outs).toBe(0);
    expect(card.inningHalf).toBe("bottom");
  });

  it("bumps outsAfter on a strikeout", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 4, phase: "top", description: "Strikes out swinging." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.situationBefore.outs).toBe(0);
    expect(card.outsAfter).toBe(1);
  });

  it("adds two outs on a double play", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 3, quarter: 5, phase: "top", description: "Walks." },
      { playIndex: 2, tier: 1, quarter: 5, phase: "top", description: "Grounds into a double play." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const card = res.cards.find((c) => c.kind === "play" && c.playIndex === 2);
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.eventType).toBe("double_play");
    expect(card.outsAfter).toBe(2);
  });
});

describe("priorAfter (state continuity between displayed cards)", () => {
  it("attaches priorAfter to the second play card of the same half-inning", () => {
    // Two scoring plays in the same half — the second should inherit the
    // first's ending state for the bridging beat.
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 3, phase: "top",
        description: "Doubles to left.", playerName: "Soto",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 0 },
      // A tier-3 strikeout slips between — must change outs without becoming a card.
      { playIndex: 2, tier: 3, quarter: 3, phase: "top", description: "Strikes out." },
      { playIndex: 3, tier: 1, quarter: 3, phase: "top",
        description: "Singles, Soto scores.", playerName: "Judge",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 1,
        pointsScored: 1, scoringTeamAbbr: "NYY" },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const second = res.cards.find((c) => c.kind === "play" && c.playIndex === 3);
    if (second?.kind !== "play") throw new Error("expected play card");
    expect(second.priorAfter).toBeDefined();
    // The strikeout in between bumped outs from 0 to 1; bridging should
    // light that dot up before the play fires.
    expect(second.priorAfter!.outs).toBe(0);
    expect(second.situationBefore.outs).toBe(1);
    expect(second.priorAfter!.baseState.second).toBe(true);
  });

  it("does NOT attach priorAfter to the first play card of the deck", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, phase: "top", description: "Singles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const first = res.cards.find((c) => c.kind === "play");
    if (first?.kind !== "play") throw new Error("expected play card");
    expect(first.priorAfter).toBeUndefined();
  });
});

describe("inning transition cards", () => {
  it("inserts an inning-transition card after a scoring half-inning rolls over", () => {
    const plays: PlayEntry[] = [
      // 2-run HR → meaningful half (≥2 runs gate).
      {
        playIndex: 1, tier: 1, quarter: 3, phase: "top", description: "2-run HR.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 2,
        pointsScored: 2, scoringTeamAbbr: "NYY",
      },
      { playIndex: 2, tier: 1, quarter: 3, phase: "bottom", description: "Doubles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const transition = res.cards.find((c) => c.kind === "inning-transition");
    expect(transition).toBeDefined();
    if (transition?.kind !== "inning-transition") throw new Error("expected transition");
    expect(transition.fromInning).toBe(3);
    expect(transition.fromHalf).toBe("top");
    expect(transition.toHalf).toBe("bottom");
  });

  it("does NOT insert a transition when the previous half was silent (no scoring)", () => {
    const plays: PlayEntry[] = [
      // Non-scoring half — pacing planner should let it roll silently.
      { playIndex: 1, tier: 2, quarter: 3, phase: "top", description: "Doubles." },
      { playIndex: 2, tier: 1, quarter: 3, phase: "bottom", description: "HR." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const transition = res.cards.find((c) => c.kind === "inning-transition");
    expect(transition).toBeUndefined();
  });

  it("clears priorAfter on the play card that follows an inning transition", () => {
    // The transition card itself bridges — the next play card mounts fresh.
    const plays: PlayEntry[] = [
      {
        playIndex: 1, tier: 1, quarter: 3, phase: "top", description: "2-run HR.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 2,
        pointsScored: 2, scoringTeamAbbr: "NYY",
      },
      { playIndex: 2, tier: 1, quarter: 3, phase: "bottom", description: "Doubles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const second = res.cards.find((c) => c.kind === "play" && c.playIndex === 2);
    if (second?.kind !== "play") throw new Error("expected play card");
    expect(second.priorAfter).toBeUndefined();
  });

  it("captures the score state at the transition", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, phase: "top", description: "2-run HR.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 2,
        pointsScored: 2, scoringTeamAbbr: "NYY" },
      { playIndex: 2, tier: 1, quarter: 1, phase: "bottom", description: "Singles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const transition = res.cards.find((c) => c.kind === "inning-transition");
    if (transition?.kind !== "inning-transition") throw new Error("expected transition");
    expect(transition.score).toEqual({ home: 0, away: 2 });
    expect(transition.subtitle).toMatch(/lead/i);
  });

  it("orders inning-transition cards into the deck before the next play card", () => {
    const plays: PlayEntry[] = [
      {
        playIndex: 1, tier: 1, quarter: 1, phase: "top", description: "2-run HR.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 2,
        pointsScored: 2, scoringTeamAbbr: "NYY",
      },
      { playIndex: 2, tier: 1, quarter: 1, phase: "bottom", description: "Doubles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true });
    const idx = (kind: string) => res.cards.findIndex((c) => c.kind === kind);
    expect(idx("scene-setter")).toBe(0);
    const tx = idx("inning-transition");
    const playIndices = res.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.kind === "play");
    expect(tx).toBeGreaterThan(0);
    expect(playIndices[0].i).toBeLessThan(tx);
    expect(playIndices[1].i).toBeGreaterThan(tx);
  });
});

describe("narrative layer", () => {
  it("attaches a richer narrative sentence to home runs", () => {
    const p = play(1, 1, {
      description: "Homers to deep right.",
      playerName: "Aaron Judge",
      homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 1,
      pointsScored: 1, scoringTeamAbbr: "NYY",
    });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.narrative).toBeDefined();
    expect(card.narrative).toMatch(/judge/i);
    expect(card.narrative!.endsWith(".") || card.narrative!.endsWith("!")).toBe(true);
  });

  it("preserves the raw humanized description even when narrative is set", () => {
    const p = play(1, 1, { description: "Walks on a 3-2 pitch.", playerName: "Soto" });
    const res = buildCatchupCards({ ...SCENE_INPUT, plays: [p], isFinal: true });
    const card = res.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.description).toBe("Walks on a 3-2 pitch.");
    expect(card.narrative).toBeDefined();
  });
});

describe("forced-include selection (Track A)", () => {
  it("force-includes a tier-3 scoring play even though it's normally below the bar", () => {
    const plays: PlayEntry[] = [
      // A tier-3 RBI groundout still scores a run — must surface in the deck.
      {
        playIndex: 1, tier: 3, quarter: 6, phase: "bottom",
        description: "Grounds out, RBI scores.",
        homeScore: 1, awayScore: 0, homeScoreBefore: 0, awayScoreBefore: 0,
        pointsScored: 1, scoringTeamAbbr: "BOS",
      },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true, withAudit: true });
    const card = res.cards.find((c) => c.kind === "play" && c.playIndex === 1);
    expect(card).toBeDefined();
    const auditRow = res.audit?.find((r) => r.playIndex === 1);
    expect(auditRow?.isScoringPlay).toBe(true);
    expect(auditRow?.isSelectedForCatchup).toBe(true);
    expect(auditRow?.selectionReasons).toContain("scoring");
  });

  it("flags lead-change plays in the audit and includes them", () => {
    const plays: PlayEntry[] = [
      // Visiting team scores first.
      { playIndex: 1, tier: 1, quarter: 3, phase: "top", description: "Soto homers to right.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 1, pointsScored: 1, scoringTeamAbbr: "NYY" },
      // Home team hits a 2-run shot to take the lead.
      { playIndex: 2, tier: 1, quarter: 5, phase: "bottom", description: "Devers homers, 2 RBI.",
        homeScoreBefore: 0, awayScoreBefore: 1, homeScore: 2, awayScore: 1, pointsScored: 2, scoringTeamAbbr: "BOS" },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true, withAudit: true });
    const lead = res.audit?.find((r) => r.playIndex === 2);
    expect(lead?.isLeadChangePlay).toBe(true);
    expect(lead?.selectionReasons).toContain("lead-change");
  });

  it("flags tying plays in the audit", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, phase: "top", description: "Solo HR.",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 1, pointsScored: 1, scoringTeamAbbr: "NYY" },
      { playIndex: 2, tier: 1, quarter: 4, phase: "bottom", description: "RBI single ties it.",
        homeScoreBefore: 0, awayScoreBefore: 1, homeScore: 1, awayScore: 1, pointsScored: 1, scoringTeamAbbr: "BOS" },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true, withAudit: true });
    const tying = res.audit?.find((r) => r.playIndex === 2);
    expect(tying?.isTyingPlay).toBe(true);
    expect(tying?.selectionReasons).toContain("tying");
  });

  it("flags late-leverage plays in the 7th+ when the game is close", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 3, quarter: 8, phase: "top", description: "Singles to center.",
        homeScoreBefore: 2, awayScoreBefore: 1, homeScore: 2, awayScore: 1 },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true, withAudit: true });
    const audit = res.audit?.find((r) => r.playIndex === 1);
    expect(audit?.isLateLeverage).toBe(true);
    expect(audit?.selectionReasons).toContain("late-leverage");
  });

  it("returns a complete audit table when withAudit=true", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, phase: "top", description: "HR." },
      { playIndex: 2, tier: 3, quarter: 1, phase: "top", description: "Grounds out." },
      { playIndex: 3, tier: 2, quarter: 2, phase: "bottom", description: "Doubles." },
    ];
    const res = buildCatchupCards({ ...SCENE_INPUT, plays, isFinal: true, withAudit: true });
    expect(res.audit).toBeDefined();
    expect(res.audit).toHaveLength(3);
    expect(res.audit!.every((r) => Array.isArray(r.selectionReasons) && r.selectionReasons.length > 0)).toBe(true);
  });
});

describe("humanizeDescription", () => {
  it("strips parenthetical annotations and adds a trailing period", () => {
    expect(humanizeDescription("Judge homers (Soto scored)")).toBe("Judge homers.");
  });
  it("strips bracketed annotations", () => {
    expect(humanizeDescription("Lindor singles [RBI]")).toBe("Lindor singles.");
  });
  it("capitalizes the first letter", () => {
    expect(humanizeDescription("walks on a 3-2 pitch")).toBe("Walks on a 3-2 pitch.");
  });
  it("normalizes already-terminated sentences", () => {
    expect(humanizeDescription("Strikes out swinging.")).toBe("Strikes out swinging.");
    expect(humanizeDescription("Strikes out swinging!")).toBe("Strikes out swinging!");
  });
  it("returns empty string for empty input", () => {
    expect(humanizeDescription("")).toBe("");
    expect(humanizeDescription("   ")).toBe("");
  });
  it("collapses internal whitespace", () => {
    expect(humanizeDescription("doubles  to    deep left")).toBe("Doubles to deep left.");
  });
});

describe("computeTimeline (half-inning derivation)", () => {
  it("trusts upstream phase when present", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 5, phase: "bottom", description: "single" },
    ];
    const tl = computeTimeline(plays, "BOS");
    expect(tl.get(1)?.half).toBe("bottom");
  });

  it("derives half from outs when phase is missing", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 3, quarter: 1, description: "strikes out" },
      { playIndex: 2, tier: 3, quarter: 1, description: "grounds out" },
      { playIndex: 3, tier: 3, quarter: 1, description: "flies out" },
      { playIndex: 4, tier: 1, quarter: 1, description: "singles to right" },
    ];
    const tl = computeTimeline(plays, "BOS");
    expect(tl.get(1)?.half).toBe("top");
    expect(tl.get(4)?.half).toBe("bottom");
  });

  it("flips the half when the batting team changes mid-inning, even if outs < 3", () => {
    // Reproduces 190177-style upstream feeds: phase is "early" and
    // periodLabel is just "1st", so the only half-inning signal is
    // teamAbbreviation. The visiting half ends with only two visible outs
    // (a tier-filtered or otherwise omitted third out), so the bases would
    // bleed into the home half without team-based detection.
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Seager",
        description: "Corey Seager walks." },
      { playIndex: 2, tier: 3, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", description: "Pederson grounds out." },
      // Top of 1st ends here in upstream — third out is missing.
      { playIndex: 3, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "NYY", playerName: "Paul Goldschmidt",
        description: "Paul Goldschmidt triples." },
      { playIndex: 4, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "NYY", playerName: "Bellinger",
        description: "Cody Bellinger triples. Goldschmidt scores.",
        scoreBefore: { home: 0, away: 0 },
        score: { home: 1, away: 0 },
        scoringTeamAbbr: "NYY", pointsScored: 1 },
    ];
    const tl = computeTimeline(plays, "NYY");
    // Half flips on the team change, even though outs in TEX's half never
    // reached 3 in the visible feed.
    expect(tl.get(2)?.half).toBe("top");
    expect(tl.get(3)?.half).toBe("bottom");
    // Goldschmidt's triple in the bottom half puts him on third for the
    // next NYY play — and Bellinger's triple sees him there.
    expect(tl.get(4)?.runnerNamesBefore?.third).toBe("Paul Goldschmidt");
    // The scoring run is attributed to a third→home advance, not a
    // phantom (the run-constraint must find Goldschmidt to score).
    const advances = tl.get(4)?.advances ?? [];
    expect(advances.some((a) => a.from === "third" && a.to === "home")).toBe(true);
  });
});

describe("computeTimeline (forward-propagated base state)", () => {
  it("a triple in play 1 puts a runner on third for play 2's before-state", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 2, phase: "top",
        description: "Clemens triples to deep center.",
        playerName: "Kody Clemens" },
      { playIndex: 2, tier: 1, quarter: 2, phase: "top",
        description: "Tristan Gray flies into a double play, Clemens out at home.",
        playerName: "Tristan Gray" },
    ];
    const tl = computeTimeline(plays, "WSH");
    const p1 = tl.get(1);
    const p2 = tl.get(2);
    // After the triple, third base is occupied by Clemens.
    expect(p1?.baseStateAfter).toEqual({ first: false, second: false, third: true });
    expect(p1?.runnerNamesAfter?.third).toBe("Kody Clemens");
    // The DP starts with Clemens on third — NOT empty bases.
    expect(p2?.baseStateBefore).toEqual({ first: false, second: false, third: true });
    expect(p2?.runnerNamesBefore?.third).toBe("Kody Clemens");
  });

  it("clears bases when a half-inning ends (3 outs)", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 4, phase: "top",
        description: "Walks.", playerName: "Soto" },
      { playIndex: 2, tier: 3, quarter: 4, phase: "top", description: "Strikes out." },
      { playIndex: 3, tier: 3, quarter: 4, phase: "top", description: "Strikes out." },
      { playIndex: 4, tier: 3, quarter: 4, phase: "top", description: "Strikes out." },
      // Bottom half — bases must be empty entering the first play.
      { playIndex: 5, tier: 1, quarter: 4, phase: "bottom", description: "Doubles." },
    ];
    const tl = computeTimeline(plays, "WSH");
    // The doubles play's BEFORE state — bases must be empty because the
    // previous half ended on the third strikeout.
    const p5 = tl.get(5);
    expect(p5?.baseStateBefore).toEqual({ first: false, second: false, third: false });
    expect(p5?.runnerNamesBefore).toEqual({});
  });

  it("propagates a runner across multiple non-scoring plays", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 3, phase: "top",
        description: "Singles to right.", playerName: "Bichette" },
      { playIndex: 2, tier: 3, quarter: 3, phase: "top",
        description: "Strikes out.", playerName: "Vladdy" },
      { playIndex: 3, tier: 1, quarter: 3, phase: "top",
        description: "Walks.", playerName: "Springer" },
    ];
    const tl = computeTimeline(plays, "BOS");
    // After play 1: Bichette on 1st.
    expect(tl.get(1)?.runnerNamesAfter?.first).toBe("Bichette");
    // Play 2 starts with Bichette still on 1st.
    expect(tl.get(2)?.runnerNamesBefore?.first).toBe("Bichette");
    // Play 3 (walk): force-advance Bichette to 2nd, Springer takes 1st.
    expect(tl.get(3)?.runnerNamesAfter?.first).toBe("Springer");
    expect(tl.get(3)?.runnerNamesAfter?.second).toBe("Bichette");
  });

  it("clears the scoring runner from base state after a home run", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, phase: "top",
        description: "Doubles.", playerName: "Soto" },
      { playIndex: 2, tier: 1, quarter: 1, phase: "top",
        description: "Judge homers, Soto scores.", playerName: "Judge",
        homeScoreBefore: 0, awayScoreBefore: 0, homeScore: 0, awayScore: 2,
        pointsScored: 2, scoringTeamAbbr: "NYY" },
    ];
    const tl = computeTimeline(plays, "BOS");
    // After the homer, every base is empty.
    expect(tl.get(2)?.baseStateAfter).toEqual({ first: false, second: false, third: false });
    expect(tl.get(2)?.runnerNamesAfter).toEqual({});
  });
});

describe("parseDescriptionAdvances", () => {
  it("extracts a scoring runner by name", () => {
    const advances = parseDescriptionAdvances(
      "Cody Bellinger triples on a sharp line drive. Paul Goldschmidt scores.",
      { third: "Paul Goldschmidt" },
      "Cody Bellinger",
    );
    expect(advances).toContainEqual({ from: "third", to: "home" });
  });

  it("extracts a runner advancing one base", () => {
    const advances = parseDescriptionAdvances(
      "Brandon Nimmo singles. Alejandro Osuna to 3rd.",
      { first: "Alejandro Osuna" },
      "Brandon Nimmo",
    );
    expect(advances).toContainEqual({ from: "first", to: "third" });
  });

  it("extracts a runner thrown out at a specific base", () => {
    const advances = parseDescriptionAdvances(
      "Ezequiel Duran grounds into a force out, Alejandro Osuna scores. Brandon Nimmo out at 2nd. Ezequiel Duran to 1st.",
      { first: "Brandon Nimmo", third: "Alejandro Osuna" },
      "Ezequiel Duran",
    );
    expect(advances).toContainEqual({ from: "third", to: "home" });
    expect(advances).toContainEqual({ from: "first", to: "out", outAt: "second" });
    expect(advances).toContainEqual({ from: "home", to: "first" });
  });

  it("ignores names it can't resolve to a base", () => {
    // "Mookie Betts scores" has no matching runner — drop it rather than
    // fabricate a `from`. A later run-constraint pass will reconcile the
    // run total against base state.
    const advances = parseDescriptionAdvances(
      "Mookie Betts scores.",
      { first: "Brandon Nimmo" },
      "Cody Bellinger",
    );
    expect(advances).toEqual([]);
  });

  it("matches runners by last name when descriptions use full names", () => {
    const advances = parseDescriptionAdvances(
      "Goldschmidt scores.",
      { third: "Paul Goldschmidt" },
      undefined,
    );
    expect(advances).toContainEqual({ from: "third", to: "home" });
  });
});

describe("computeTimeline (description-derived advances)", () => {
  it("propagates a non-batter runner advance from prose into the next play", () => {
    // Reproduces 190177's top-of-5th cascade: Osuna walks, Nimmo singles
    // and pushes Osuna to 3rd (NOT 2nd, which is what the event-type
    // heuristic would predict). The next play (Duran's force-out) needs
    // Osuna on 3rd to score.
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 5, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Alejandro Osuna",
        description: "Alejandro Osuna walks." },
      { playIndex: 2, tier: 1, quarter: 5, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Brandon Nimmo",
        description: "Brandon Nimmo singles on a sharp line drive. Alejandro Osuna to 3rd." },
      { playIndex: 3, tier: 1, quarter: 5, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Ezequiel Duran", playType: "FORCE_OUT",
        description: "Ezequiel Duran grounds into a force out. Alejandro Osuna scores. Brandon Nimmo out at 2nd. Ezequiel Duran to 1st.",
        scoreBefore: { home: 0, away: 0 },
        score: { home: 0, away: 1 },
        scoringTeamAbbr: "TEX", pointsScored: 1 },
    ];
    const tl = computeTimeline(plays, "NYY");
    // After Nimmo's single — description says Osuna goes to 3rd, NOT 2nd.
    expect(tl.get(2)?.baseStateAfter).toEqual({ first: true, second: false, third: true });
    expect(tl.get(2)?.runnerNamesAfter?.first).toBe("Brandon Nimmo");
    expect(tl.get(2)?.runnerNamesAfter?.third).toBe("Alejandro Osuna");
    // After the force-out — Duran on 1st (Nimmo retired), Osuna scored.
    expect(tl.get(3)?.baseStateBefore).toEqual({ first: true, second: false, third: true });
    expect(tl.get(3)?.baseStateAfter).toEqual({ first: true, second: false, third: false });
    expect(tl.get(3)?.runnerNamesAfter?.first).toBe("Ezequiel Duran");
    // Advances explicitly cover all three actors.
    const adv = tl.get(3)?.advances ?? [];
    expect(adv).toContainEqual({ from: "third", to: "home" });
    expect(adv).toContainEqual({ from: "first", to: "out", outAt: "second" });
    expect(adv).toContainEqual({ from: "home", to: "first" });
  });
});

describe("formatOutsAsIP", () => {
  it("converts outs to MLB IP-string", () => {
    expect(formatOutsAsIP(0)).toBe("0.0");
    expect(formatOutsAsIP(1)).toBe("0.1");
    expect(formatOutsAsIP(3)).toBe("1.0");
    expect(formatOutsAsIP(16)).toBe("5.1");
    expect(formatOutsAsIP(24)).toBe("8.0");
  });
});

describe("computePitcherTimeline", () => {
  it("attributes plays to the right pitcher by walking outs", () => {
    // Two NYY pitchers: Blackburn (1 inning = 3 outs), then Beck.
    // Top half = TEX batting → NYY pitching.
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Seager", playType: "FIELD_OUT",
        description: "Seager grounds out." },
      { playIndex: 2, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Garcia", playType: "FIELD_OUT",
        description: "Garcia flies out." },
      { playIndex: 3, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Jung", playType: "FIELD_OUT",
        description: "Jung grounds out." },
      // Top of 2nd — first batter Beck faces (Blackburn done after 3 outs).
      { playIndex: 4, tier: 1, quarter: 2, periodLabel: "2nd",
        teamAbbreviation: "TEX", playerName: "Foscue", playType: "WALK",
        description: "Foscue walks." },
    ];
    const pitchers = [
      { team: "New York Yankees", playerName: "Paul Blackburn",
        inningsPitched: "1.0", hits: 0, runs: 0, baseOnBalls: 0,
        strikeOuts: 0, homeRuns: 0 },
      { team: "Texas Rangers", playerName: "MacKenzie Gore",
        inningsPitched: "5.1", hits: 0, runs: 0, baseOnBalls: 0,
        strikeOuts: 0, homeRuns: 0 },
      { team: "New York Yankees", playerName: "Brendan Beck",
        inningsPitched: "3.0", hits: 0, runs: 0, baseOnBalls: 0,
        strikeOuts: 0, homeRuns: 0 },
    ];
    const tl = computePitcherTimeline(
      plays, pitchers,
      "New York Yankees", "Texas Rangers", "NYY",
    );
    // First three TEX outs are Blackburn's.
    expect(tl.get(1)?.name).toBe("Paul Blackburn");
    expect(tl.get(3)?.name).toBe("Paul Blackburn");
    // After 3 outs, Beck takes over.
    expect(tl.get(4)?.name).toBe("Brendan Beck");
  });

  it("accumulates a running line snapshot up to (not including) each play", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "A", playType: "WALK",
        description: "A walks." },
      { playIndex: 2, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "B", playType: "STRIKEOUT",
        description: "B strikes out." },
      { playIndex: 3, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "C", playType: "SINGLE",
        description: "C singles." },
    ];
    const pitchers = [
      { team: "New York Yankees", playerName: "Solo Pitcher",
        inningsPitched: "9.0", hits: 0, runs: 0, baseOnBalls: 0,
        strikeOuts: 0, homeRuns: 0 },
    ];
    const tl = computePitcherTimeline(
      plays, pitchers,
      "New York Yankees", "Texas Rangers", "NYY",
    );
    // Before play 1 — fresh line.
    expect(tl.get(1)?.line.outs).toBe(0);
    expect(tl.get(1)?.line.baseOnBalls).toBe(0);
    // Before play 2 — A's walk has been logged.
    expect(tl.get(2)?.line.baseOnBalls).toBe(1);
    expect(tl.get(2)?.line.outs).toBe(0);
    // Before play 3 — A's walk + B's K logged.
    expect(tl.get(3)?.line.baseOnBalls).toBe(1);
    expect(tl.get(3)?.line.strikeOuts).toBe(1);
    expect(tl.get(3)?.line.outs).toBe(1);
  });
});

describe("computeBatterTimeline", () => {
  it("counts a batter's PAs across multiple appearances", () => {
    const plays: PlayEntry[] = [
      { playIndex: 1, tier: 1, quarter: 1, periodLabel: "1st",
        teamAbbreviation: "TEX", playerName: "Marcell Ozuna", playType: "STRIKEOUT",
        description: "Marcell Ozuna strikes out swinging." },
      { playIndex: 2, tier: 1, quarter: 3, periodLabel: "3rd",
        teamAbbreviation: "TEX", playerName: "Marcell Ozuna", playType: "WALK",
        description: "Marcell Ozuna walks." },
      { playIndex: 3, tier: 1, quarter: 5, periodLabel: "5th",
        teamAbbreviation: "TEX", playerName: "Marcell Ozuna", playType: "SINGLE",
        description: "Marcell Ozuna singles." },
    ];
    const tl = computeBatterTimeline(plays);
    // First PA — empty line.
    expect(tl.get(1)?.line.atBats).toBe(0);
    expect(tl.get(1)?.line.strikeOuts).toBe(0);
    // Second PA — 0-1 with a K.
    expect(tl.get(2)?.line.atBats).toBe(1);
    expect(tl.get(2)?.line.hits).toBe(0);
    expect(tl.get(2)?.line.strikeOuts).toBe(1);
    // Third PA — 0-1 with K, BB doesn't increment AB.
    expect(tl.get(3)?.line.atBats).toBe(1);
    expect(tl.get(3)?.line.baseOnBalls).toBe(1);
    expect(tl.get(3)?.line.strikeOuts).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { adaptDeck, deriveGamePhase } from "@/lib/adapters/scroll-down-mlb-deck-adapter";
import type { SdmDeckResponse, SdmDeckCard } from "@/types/scroll-down-mlb";

function buildDeck(playOverrides: Record<string, unknown>, visualOverrides?: Record<string, unknown>): SdmDeckResponse {
  return {
    gameId: "12345",
    deckVersion: "v1",
    generatedAt: "2026-05-10T00:00:00Z",
    isFinal: false,
    spoilerPolicy: "pre_reveal",
    homeTeam: { id: "1", abbreviation: "NYY", displayName: "Yankees", colorLight: null, colorDark: null },
    awayTeam: { id: "2", abbreviation: "MIL", displayName: "Brewers", colorLight: null, colorDark: null },
    lastPlayIndex: 5,
    firstPitch: "2026-05-10T18:10:00Z",
    venue: "American Family Field",
    homeProbablePitcher: null,
    awayProbablePitcher: null,
    cards: [
      {
        id: "p1",
        type: "play",
        sortOrder: 1,
        inning: 1,
        half: "top",
        title: "Top 1st",
        description: "The batter goes deep for a solo home run.",
        play: {
          playId: "10",
          eventType: "home_run",
          label: "HOME RUN",
          subLabel: undefined,
          description: "Aaron Judge homers on a fly ball to center field.",
          batterName: null,
          pitcherName: "Freddy Peralta",
          ballsBefore: 1,
          strikesBefore: 1,
          outsBefore: 0,
          outsAfter: 0,
          baseStateBefore: { first: false, second: false, third: false },
          baseStateAfter: { first: false, second: false, third: false },
          runnerNamesBefore: {},
          runnerNamesAfter: {},
          scoreBefore: { home: 0, away: 0 },
          runsScoredOnPlay: 1,
          ...playOverrides,
        },
        visual: {
          trajectory: "hr_lcf",
          runnerMovements: [
            { runner: "Aaron Judge", from: "home", to: "home", style: "score" },
          ],
          intensity: "high",
          animationProfile: "home_run",
          ...(visualOverrides ?? {}),
        },
        leverageTier: 1,
      },
    ],
    plannerReport: null,
    validationWarnings: [],
  };
}

describe("scroll-down-mlb deck adapter — batter inference + narrative splice", () => {
  it("infers batter name from a home-plate runner movement when play.batterName is null", () => {
    const { cards } = adaptDeck(buildDeck({}));
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBe("Aaron Judge");
  });

  it("splices the inferred batter into the curated narrative when narrator left the 'the batter' placeholder", () => {
    const { cards } = adaptDeck(buildDeck({}));
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.description).toBe("Judge goes deep for a solo home run.");
  });

  it("preserves curated narrative untouched when it already names the batter", () => {
    const { cards } = adaptDeck(
      buildDeck({}, { /* keep default movements so batter is recoverable, but narration is already named */ }),
    );
    // Rebuild with an already-named card description.
    const direct = adaptDeck({
      ...buildDeck({}),
      cards: [
        {
          ...buildDeck({}).cards[0],
          description: "Judge crushes one to deep left.",
        },
      ],
    });
    const card = direct.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.description).toBe("Judge crushes one to deep left.");
    // The trivial first call is unused — keeping it asserts the adapter is
    // shape-stable under repeated calls with the same input.
    expect(cards.length).toBe(1);
  });

  it("falls back to raw play.description when narrator left a placeholder and no batter can be inferred", () => {
    const { cards } = adaptDeck(
      buildDeck({}, {
        runnerMovements: [], // strip movements so inference fails
      }),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBeUndefined();
    expect(play.description).toBe(
      "Aaron Judge homers on a fly ball to center field.",
    );
  });

  it("infers foul_right when the play description mentions first base / right field", () => {
    const { cards } = adaptDeck(
      buildDeck(
        {
          eventType: "field_out",
          description: "Aaron Judge pops out to first baseman Pete Alonso in foul territory.",
        },
        {
          trajectory: "foul",
          animationProfile: "foul",
        },
      ),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.ballPath).toBe("foul_right");
  });

  it("infers foul_left when the play description mentions third base / left field", () => {
    const { cards } = adaptDeck(
      buildDeck(
        {
          eventType: "field_out",
          description: "Aaron Judge pops out to third baseman Jose Ramirez in foul territory.",
        },
        {
          trajectory: "foul",
          animationProfile: "foul",
        },
      ),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.ballPath).toBe("foul_left");
  });

  it("defaults foul to foul_left when the description gives no directional hint", () => {
    const { cards } = adaptDeck(
      buildDeck(
        {
          eventType: "field_out",
          description: "Aaron Judge pops out in foul territory.",
        },
        {
          trajectory: "foul",
          animationProfile: "foul",
        },
      ),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.ballPath).toBe("foul_left");
  });

  it("carries the post-play score into the following inning-transition card", () => {
    const deck = buildDeck({});
    const txCard: SdmDeckCard = {
      id: "745406-tx-end-1-top",
      type: "rhythm",
      sortOrder: 2,
      inning: 1,
      half: "top",
      title: "End of 1st",
      description: "Yankees on the board.",
      play: null,
      visual: null,
      leverageTier: 0,
    };
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, txCard] });
    const tx = cards.find((c) => c.kind === "inning-transition");
    if (tx?.kind !== "inning-transition") throw new Error("expected inning-transition card");
    expect(tx.score).toEqual({ home: 0, away: 1 });
  });

  it("threads score through multiple rhythm cards after a scoring play (no mid-deck reset)", () => {
    const deck = buildDeck({});
    const rhythmAfter: SdmDeckCard[] = [
      {
        id: "745406-tx-end-1-top",
        type: "rhythm",
        sortOrder: 2,
        inning: 1,
        half: "top",
        title: "End of 1st",
        description: "",
        play: null,
        visual: null,
        leverageTier: 0,
      },
      {
        id: "745406-qs-2-4",
        type: "rhythm",
        sortOrder: 3,
        inning: 4,
        half: "top",
        title: "Innings 2-4",
        description: "Both pitchers in command.",
        play: null,
        visual: null,
        leverageTier: 0,
      },
      {
        id: "745406-lg-7-bot",
        type: "rhythm",
        sortOrder: 4,
        inning: 7,
        half: "bottom",
        title: "Late innings",
        description: "Yankees still up one.",
        play: null,
        visual: null,
        leverageTier: 0,
      },
    ];
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, ...rhythmAfter] });
    const rhythmKinds = ["inning-transition", "quiet-stretch", "late-game"] as const;
    for (const kind of rhythmKinds) {
      const card = cards.find((c) => c.kind === kind);
      if (!card || (card.kind !== "inning-transition" && card.kind !== "quiet-stretch" && card.kind !== "late-game")) {
        throw new Error(`expected ${kind} card`);
      }
      expect(card.score).toEqual({ home: 0, away: 1 });
    }
  });

  it("score is monotonically non-decreasing across the card array", () => {
    const deck = buildDeck({});
    const second: SdmDeckCard = {
      id: "745406-play-2",
      type: "play",
      sortOrder: 2,
      inning: 2,
      half: "bottom",
      title: "Bot 2nd",
      description: "Two-run shot.",
      play: {
        playId: "20",
        eventType: "home_run",
        label: "HOME RUN",
        subLabel: null,
        description: "Two-run home run.",
        batterName: "Anthony Volpe",
        pitcherName: null,
        ballsBefore: 0,
        strikesBefore: 0,
        outsBefore: 1,
        outsAfter: 1,
        baseStateBefore: { first: true, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        runnerNamesBefore: { first: "Some Runner" },
        runnerNamesAfter: {},
        scoreBefore: { home: 0, away: 1 },
        runsScoredOnPlay: 2,
      },
      visual: {
        trajectory: "hr_lcf",
        runnerMovements: [
          { runner: "Anthony Volpe", from: "home", to: "home", style: "score" },
          { runner: "Some Runner", from: "first", to: "home", style: "score" },
        ],
        intensity: "high",
        animationProfile: "home_run",
      },
      leverageTier: 1,
    };
    const tx: SdmDeckCard = {
      id: "745406-tx-end-2-bot",
      type: "rhythm",
      sortOrder: 3,
      inning: 2,
      half: "bottom",
      title: "End of 2nd",
      description: "",
      play: null,
      visual: null,
      leverageTier: 0,
    };
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, second, tx] });
    let prevHome = 0;
    let prevAway = 0;
    for (const card of cards) {
      const score =
        card.kind === "play"
          ? card.scoreAfter
          : card.kind === "inning-transition" || card.kind === "quiet-stretch" || card.kind === "late-game" || card.kind === "final-setup"
          ? card.score
          : null;
      if (!score) continue;
      expect(score.home).toBeGreaterThanOrEqual(prevHome);
      expect(score.away).toBeGreaterThanOrEqual(prevAway);
      prevHome = score.home;
      prevAway = score.away;
    }
    expect(prevHome).toBe(2);
    expect(prevAway).toBe(1);
  });

  it("renders 0-0 on every rhythm card when the deck has no play cards", () => {
    const deck = buildDeck({});
    const rhythmOnly: SdmDeckResponse = {
      ...deck,
      cards: [
        {
          id: "745406-qs-pre",
          type: "rhythm",
          sortOrder: 1,
          inning: 1,
          half: "top",
          title: "Quiet start",
          description: "Pitchers' duel through three.",
          play: null,
          visual: null,
          leverageTier: 0,
        },
        {
          id: "745406-tx-end-3-bot",
          type: "rhythm",
          sortOrder: 2,
          inning: 3,
          half: "bottom",
          title: "End of 3rd",
          description: "",
          play: null,
          visual: null,
          leverageTier: 0,
        },
      ],
    };
    const { cards } = adaptDeck(rhythmOnly);
    for (const card of cards) {
      if (card.kind === "quiet-stretch" || card.kind === "inning-transition") {
        expect(card.score).toEqual({ home: 0, away: 0 });
      }
    }
  });

  it("does not stamp a score field onto scene-setter cards", () => {
    const deck = buildDeck({});
    const sceneFirst: SdmDeckResponse = {
      ...deck,
      cards: [
        {
          id: "745406-scene",
          type: "scene",
          sortOrder: 0,
          inning: null,
          half: null,
          title: "First pitch",
          description: "Tonight in the Bronx.",
          play: null,
          visual: null,
          leverageTier: 0,
        },
        ...deck.cards,
      ],
    };
    const { cards } = adaptDeck(sceneFirst);
    const scene = cards.find((c) => c.kind === "scene-setter");
    if (scene?.kind !== "scene-setter") throw new Error("expected scene-setter card");
    expect("score" in scene).toBe(false);
  });

  it("rhythm card score objects are not aliased to the cursor (spread-copied)", () => {
    const deck = buildDeck({});
    const two: SdmDeckCard[] = [
      {
        id: "745406-tx-end-1-top",
        type: "rhythm",
        sortOrder: 2,
        inning: 1,
        half: "top",
        title: "End of 1st",
        description: "",
        play: null,
        visual: null,
        leverageTier: 0,
      },
      {
        id: "745406-qs-2-4",
        type: "rhythm",
        sortOrder: 3,
        inning: 4,
        half: "top",
        title: "Quiet stretch",
        description: "",
        play: null,
        visual: null,
        leverageTier: 0,
      },
    ];
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, ...two] });
    const tx = cards.find((c) => c.kind === "inning-transition");
    const qs = cards.find((c) => c.kind === "quiet-stretch");
    if (tx?.kind !== "inning-transition" || qs?.kind !== "quiet-stretch") {
      throw new Error("expected both rhythm cards");
    }
    expect(tx.score).not.toBe(qs.score);
    expect(tx.score).toEqual(qs.score);
  });

  it("recovers batter from runnerNamesAfter when movement.runner is empty (walk to first)", () => {
    const { cards } = adaptDeck(
      buildDeck(
        {
          eventType: "walk",
          description: "Bo Bichette walks.",
          baseStateAfter: { first: true, second: false, third: false },
          runnerNamesAfter: { first: "Bo Bichette" },
        },
        {
          runnerMovements: [
            { runner: "", from: "home", to: "first", style: "walk_shuffle" },
          ],
          animationProfile: "walk",
          trajectory: "none",
        },
      ),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBe("Bo Bichette");
  });
});

function buildPlay(overrides: {
  id: string;
  sortOrder: number;
  inning: number;
  half: "top" | "bottom";
  playId: string;
  outsBefore: number;
  outsAfter: number;
  baseStateBefore?: { first: boolean; second: boolean; third: boolean };
  baseStateAfter?: { first: boolean; second: boolean; third: boolean };
  runnerNamesAfter?: Record<string, string>;
  scoreBefore?: { home: number; away: number };
  runsScoredOnPlay?: number;
  batterName?: string | null;
  description?: string;
}): SdmDeckCard {
  return {
    id: overrides.id,
    type: "play",
    sortOrder: overrides.sortOrder,
    inning: overrides.inning,
    half: overrides.half,
    title: null,
    description: overrides.description ?? "Single to right.",
    play: {
      playId: overrides.playId,
      eventType: "single",
      label: "SINGLE",
      subLabel: null,
      description: overrides.description ?? "Bo Bichette singles to right.",
      batterName: overrides.batterName ?? "Bo Bichette",
      pitcherName: "Freddy Peralta",
      ballsBefore: 0,
      strikesBefore: 0,
      outsBefore: overrides.outsBefore,
      outsAfter: overrides.outsAfter,
      baseStateBefore: overrides.baseStateBefore ?? { first: false, second: false, third: false },
      baseStateAfter: overrides.baseStateAfter ?? { first: true, second: false, third: false },
      runnerNamesBefore: {},
      runnerNamesAfter: overrides.runnerNamesAfter ?? { first: "Bo Bichette" },
      scoreBefore: overrides.scoreBefore ?? { home: 0, away: 0 },
      runsScoredOnPlay: overrides.runsScoredOnPlay ?? 0,
    },
    visual: {
      trajectory: "gb_1b",
      runnerMovements: [
        { runner: overrides.batterName ?? "Bo Bichette", from: "home", to: "first", style: "advance" },
      ],
      intensity: "medium",
      animationProfile: "single",
    },
    leverageTier: 0,
  };
}

function buildRhythmCard(opts: { id: string; sortOrder: number; inning: number; half: "top" | "bottom"; title: string }): SdmDeckCard {
  return {
    id: opts.id,
    type: "rhythm",
    sortOrder: opts.sortOrder,
    inning: opts.inning,
    half: opts.half,
    title: opts.title,
    description: "",
    play: null,
    visual: null,
    leverageTier: 0,
  };
}

describe("scroll-down-mlb deck adapter — priorAfter bridge wiring", () => {
  it("attaches priorAfter on the second of two consecutive play cards", () => {
    const deck = buildDeck({});
    const second = buildPlay({
      id: "p2",
      sortOrder: 2,
      inning: 1,
      half: "top",
      playId: "11",
      outsBefore: 0,
      outsAfter: 1,
      baseStateBefore: { first: false, second: false, third: false },
      baseStateAfter: { first: false, second: false, third: false },
      runnerNamesAfter: {},
      scoreBefore: { home: 0, away: 1 },
    });
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, second] });
    const plays = cards.filter((c) => c.kind === "play");
    expect(plays.length).toBe(2);
    if (plays[0].kind !== "play" || plays[1].kind !== "play") throw new Error("expected play cards");
    expect(plays[0].priorAfter).toBeUndefined();
    expect(plays[1].priorAfter).toBeDefined();
    expect(plays[1].priorAfter?.score).toEqual(plays[0].scoreAfter);
    expect(plays[1].priorAfter?.baseState).toEqual(plays[0].baseStateAfter);
    expect(plays[1].priorAfter?.outs).toBe(plays[0].outsAfter);
  });

  it("threads priorAfter across a quiet-stretch rhythm card", () => {
    const deck = buildDeck({});
    const qs = buildRhythmCard({ id: "745406-qs-2-4", sortOrder: 2, inning: 4, half: "top", title: "Innings 2-4" });
    const afterQs = buildPlay({
      id: "p2",
      sortOrder: 3,
      inning: 5,
      half: "top",
      playId: "20",
      outsBefore: 0,
      outsAfter: 1,
      scoreBefore: { home: 0, away: 1 },
    });
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, qs, afterQs] });
    const plays = cards.filter((c) => c.kind === "play");
    if (plays[1]?.kind !== "play") throw new Error("expected second play card");
    expect(plays[1].priorAfter).toBeDefined();
    expect(plays[1].priorAfter?.score).toEqual({ home: 0, away: 1 });
  });

  it("threads priorAfter across a late-game rhythm card", () => {
    const deck = buildDeck({});
    const lg = buildRhythmCard({ id: "745406-lg-7-bot", sortOrder: 2, inning: 7, half: "bottom", title: "Late innings" });
    const afterLg = buildPlay({
      id: "p2",
      sortOrder: 3,
      inning: 8,
      half: "top",
      playId: "30",
      outsBefore: 1,
      outsAfter: 2,
      scoreBefore: { home: 0, away: 1 },
    });
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, lg, afterLg] });
    const plays = cards.filter((c) => c.kind === "play");
    if (plays[1]?.kind !== "play") throw new Error("expected second play card");
    expect(plays[1].priorAfter).toBeDefined();
    expect(plays[1].priorAfter?.outs).toBe(0);
  });

  it("does not attach priorAfter when the prior card is an inning-transition (hard reset)", () => {
    const deck = buildDeck({});
    const tx = buildRhythmCard({ id: "745406-tx-end-1-top", sortOrder: 2, inning: 1, half: "top", title: "End of 1st" });
    const afterTx = buildPlay({
      id: "p2",
      sortOrder: 3,
      inning: 1,
      half: "bottom",
      playId: "20",
      outsBefore: 0,
      outsAfter: 1,
      scoreBefore: { home: 0, away: 1 },
    });
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, tx, afterTx] });
    const plays = cards.filter((c) => c.kind === "play");
    if (plays[1]?.kind !== "play") throw new Error("expected second play card");
    expect(plays[1].priorAfter).toBeUndefined();
  });

  it("never attaches priorAfter to the first play card in the deck", () => {
    const deck = buildDeck({});
    const { cards } = adaptDeck(deck);
    const first = cards.find((c) => c.kind === "play");
    if (first?.kind !== "play") throw new Error("expected play card");
    expect(first.priorAfter).toBeUndefined();
  });

  it("first play after a leading scene-setter receives no priorAfter", () => {
    const deck = buildDeck({});
    const scene: SdmDeckCard = {
      id: "745406-scene",
      type: "scene",
      sortOrder: 0,
      inning: null,
      half: null,
      title: "First pitch",
      description: "Tonight in the Bronx.",
      play: null,
      visual: null,
      leverageTier: 0,
    };
    const { cards } = adaptDeck({ ...deck, cards: [scene, ...deck.cards] });
    const first = cards.find((c) => c.kind === "play");
    if (first?.kind !== "play") throw new Error("expected play card");
    expect(first.priorAfter).toBeUndefined();
  });

  it("priorAfter snapshot captures inning/inningHalf so cross-inning bridges have full delta signal", () => {
    const deck = buildDeck({});
    const qs = buildRhythmCard({ id: "745406-qs-2-4", sortOrder: 2, inning: 4, half: "top", title: "Innings 2-4" });
    const afterQs = buildPlay({
      id: "p2",
      sortOrder: 3,
      inning: 5,
      half: "bottom",
      playId: "20",
      outsBefore: 0,
      outsAfter: 1,
      scoreBefore: { home: 0, away: 1 },
    });
    const { cards } = adaptDeck({ ...deck, cards: [...deck.cards, qs, afterQs] });
    const plays = cards.filter((c) => c.kind === "play");
    if (plays[1]?.kind !== "play") throw new Error("expected second play card");
    expect(plays[1].priorAfter?.inning).toBe(1);
    expect(plays[1].priorAfter?.inningHalf).toBe("top");
  });
});

// Fixture mirrors the Goldschmidt HR → breath-card scenario from the
// findings. Bottom-3rd solo home run for the home team with non-zero
// starting scores on both sides — the carry-forward into the following
// inning-transition is the regression anchor the test design called out.
function makeBottomInningHrDeck(): SdmDeckResponse {
  return {
    gameId: "745406",
    deckVersion: "v1",
    generatedAt: "2024-04-15T20:10:00Z",
    isFinal: false,
    spoilerPolicy: "pre_reveal",
    homeTeam: { id: "1", abbreviation: "ARI", displayName: "Arizona", colorLight: null, colorDark: null },
    awayTeam: { id: "2", abbreviation: "LAD", displayName: "Los Angeles", colorLight: null, colorDark: null },
    lastPlayIndex: 42,
    firstPitch: "2024-04-15T20:10:00Z",
    venue: "Chase Field",
    homeProbablePitcher: null,
    awayProbablePitcher: null,
    cards: [
      {
        id: "745406-play-42",
        type: "play",
        sortOrder: 0,
        inning: 3,
        half: "bottom",
        title: "Bot 3",
        description: "Goldschmidt crushes one to left-center.",
        play: {
          playId: "42",
          eventType: "home_run",
          label: "HOME RUN",
          subLabel: null,
          description: "Paul Goldschmidt homers on a fly ball to left center field.",
          batterName: "Paul Goldschmidt",
          pitcherName: "Tyler Glasnow",
          ballsBefore: 2,
          strikesBefore: 2,
          outsBefore: 1,
          outsAfter: 1,
          baseStateBefore: { first: false, second: false, third: false },
          baseStateAfter: { first: false, second: false, third: false },
          runnerNamesBefore: {},
          runnerNamesAfter: {},
          scoreBefore: { home: 2, away: 1 },
          runsScoredOnPlay: 1,
        },
        visual: {
          trajectory: "hr_lcf",
          runnerMovements: [
            { runner: "Paul Goldschmidt", from: "home", to: "home", style: "score" },
          ],
          intensity: "high",
          animationProfile: "home_run",
        },
        leverageTier: 1,
      },
      {
        id: "745406-tx-end-3-bot",
        type: "rhythm",
        sortOrder: 1,
        inning: 3,
        half: "bottom",
        title: "End of 3rd",
        description: "ARI leads.",
        play: null,
        visual: null,
        leverageTier: 0,
      },
    ],
    plannerReport: null,
    validationWarnings: [],
  };
}

describe("scroll-down-mlb deck adapter — score computation and carry-forward", () => {
  it("returns two adapted cards from a play + inning-transition fixture", () => {
    const { cards } = adaptDeck(makeBottomInningHrDeck());
    expect(cards).toHaveLength(2);
  });

  it("computes correct scoreAfter for a bottom-inning HR (home team scores)", () => {
    const { cards } = adaptDeck(makeBottomInningHrDeck());
    const play = cards[0];
    if (play.kind !== "play") throw new Error("expected play card");
    expect(play.scoreBefore).toEqual({ home: 2, away: 1 });
    expect(play.scoreAfter).toEqual({ home: 3, away: 1 });
  });

  it("carries scoreAfter into the following inning-transition card", () => {
    const { cards } = adaptDeck(makeBottomInningHrDeck());
    const tx = cards[1];
    if (tx.kind !== "inning-transition") throw new Error("expected inning-transition card");
    expect(tx.score).toEqual({ home: 3, away: 1 });
  });

  it("adds runs to away score for a top-inning HR", () => {
    const deck: SdmDeckResponse = {
      ...makeBottomInningHrDeck(),
      cards: [
        {
          id: "745406-play-10",
          type: "play",
          sortOrder: 0,
          inning: 2,
          half: "top",
          title: "Top 2",
          description: "Two-run blast.",
          play: {
            playId: "10",
            eventType: "home_run",
            label: "HOME RUN",
            subLabel: null,
            description: "Mookie Betts homers on a fly ball.",
            batterName: "Mookie Betts",
            pitcherName: null,
            ballsBefore: 1,
            strikesBefore: 0,
            outsBefore: 0,
            outsAfter: 0,
            baseStateBefore: { first: true, second: false, third: false },
            baseStateAfter: { first: false, second: false, third: false },
            runnerNamesBefore: { first: "Freddie Freeman" },
            runnerNamesAfter: {},
            scoreBefore: { home: 1, away: 0 },
            runsScoredOnPlay: 2,
          },
          visual: {
            trajectory: "hr_lcf",
            runnerMovements: [
              { runner: "Mookie Betts", from: "home", to: "home", style: "score" },
              { runner: "Freddie Freeman", from: "first", to: "home", style: "score" },
            ],
            intensity: "high",
            animationProfile: "home_run",
          },
          leverageTier: 1,
        },
      ],
    };
    const { cards } = adaptDeck(deck);
    const play = cards[0];
    if (play.kind !== "play") throw new Error("expected play card");
    expect(play.scoreAfter).toEqual({ home: 1, away: 2 });
  });

  it("does not mutate the input scoreBefore object", () => {
    const deck = makeBottomInningHrDeck();
    const originalScoreBefore = deck.cards[0].play?.scoreBefore;
    adaptDeck(deck);
    expect(originalScoreBefore).toEqual({ home: 2, away: 1 });
  });
});

describe("deriveGamePhase", () => {
  it("returns 'final' when isFinal is true (regardless of lastPlayIndex)", () => {
    expect(deriveGamePhase({ isFinal: true, lastPlayIndex: 0 })).toBe("final");
    expect(deriveGamePhase({ isFinal: true, lastPlayIndex: 87 })).toBe("final");
    expect(deriveGamePhase({ isFinal: true, lastPlayIndex: null })).toBe("final");
  });

  it("returns 'live' when not final and lastPlayIndex > 0", () => {
    expect(deriveGamePhase({ isFinal: false, lastPlayIndex: 1 })).toBe("live");
    expect(deriveGamePhase({ isFinal: false, lastPlayIndex: 42 })).toBe("live");
  });

  it("returns 'scheduled' when not final and no plays have happened", () => {
    expect(deriveGamePhase({ isFinal: false, lastPlayIndex: null })).toBe("scheduled");
    expect(deriveGamePhase({ isFinal: false, lastPlayIndex: -1 })).toBe("scheduled");
    expect(deriveGamePhase({ isFinal: false, lastPlayIndex: 0 })).toBe("scheduled");
  });
});

describe("adaptSceneCard — game phase wiring", () => {
  function deckWithScene(over: Partial<SdmDeckResponse>): SdmDeckResponse {
    const base = buildDeck({});
    const scene: SdmDeckCard = {
      id: "999-scene",
      type: "scene",
      sortOrder: 0,
      inning: null,
      half: null,
      title: "First pitch",
      description: "Tonight in the Bronx.",
      play: null,
      visual: null,
      leverageTier: 0,
    };
    return { ...base, cards: [scene], ...over };
  }

  it("sets gamePhase 'final' and isFinal true when the deck is final", () => {
    const { cards } = adaptDeck(deckWithScene({ isFinal: true, lastPlayIndex: 87 }));
    const scene = cards.find((c) => c.kind === "scene-setter");
    if (scene?.kind !== "scene-setter") throw new Error("expected scene-setter card");
    expect(scene.gamePhase).toBe("final");
    expect(scene.isFinal).toBe(true);
  });

  it("sets gamePhase 'live' when the game has plays and is not final", () => {
    const { cards } = adaptDeck(deckWithScene({ isFinal: false, lastPlayIndex: 12 }));
    const scene = cards.find((c) => c.kind === "scene-setter");
    if (scene?.kind !== "scene-setter") throw new Error("expected scene-setter card");
    expect(scene.gamePhase).toBe("live");
    expect(scene.isFinal).toBe(false);
  });

  it("sets gamePhase 'scheduled' before the first pitch (no plays, not final)", () => {
    const { cards } = adaptDeck(deckWithScene({ isFinal: false, lastPlayIndex: null }));
    const scene = cards.find((c) => c.kind === "scene-setter");
    if (scene?.kind !== "scene-setter") throw new Error("expected scene-setter card");
    expect(scene.gamePhase).toBe("scheduled");
    expect(scene.isFinal).toBe(false);
  });
});

describe("scroll-down-mlb deck adapter — defensive normalization", () => {
  it("deduplicates cards that share the same wire id (poll-boundary race)", () => {
    // Two cards with identical id — observed during a live-poll boundary
    // when the backend briefly emits the same play twice. React would
    // warn on the duplicate key; the adapter drops the second copy.
    const deck = buildDeck({});
    const dup: SdmDeckCard = { ...deck.cards[0], sortOrder: 2 };
    deck.cards = [deck.cards[0], dup];

    const { cards } = adaptDeck(deck);
    const playCards = cards.filter((c) => c.kind === "play");
    expect(playCards).toHaveLength(1);
    expect(playCards[0].cardId).toBe("p1");
  });
});

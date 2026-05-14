import { describe, expect, it } from "vitest";
import { adaptDeck, deriveGamePhase } from "@/lib/adapters/scroll-down-mlb-deck-adapter";
import type {
  SdmDeckResponse,
  SdmDeckCard,
  SdmHalfInningContainer,
  SdmHalfInningEvent,
  SdmScrollDownEventResult,
  SdmScrollDownEventMatchup,
  SdmBaseMovement,
} from "@/types/scroll-down-mlb";

// ── Test fixture helpers ────────────────────────────────────

const HOME_TEAM = {
  id: "1",
  abbreviation: "NYY",
  displayName: "Yankees",
  colorLight: null,
  colorDark: null,
};
const AWAY_TEAM = {
  id: "2",
  abbreviation: "MIL",
  displayName: "Brewers",
  colorLight: null,
  colorDark: null,
};

function makeResult(
  overrides: Partial<SdmScrollDownEventResult> = {},
): SdmScrollDownEventResult {
  return {
    label: "HOME RUN",
    description: "Solo home run.",
    eventType: "home_run",
    isOut: false,
    isStrikeout: false,
    isWalk: false,
    isHit: true,
    isScoringPlay: true,
    isInningEnding: false,
    ...overrides,
  };
}

function makeMatchup(
  overrides: Partial<SdmScrollDownEventMatchup> = {},
): SdmScrollDownEventMatchup {
  return {
    batter: { id: "judge", name: "A Judge" },
    pitcher: { id: "peralta", name: "F Peralta" },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SdmHalfInningEvent> = {}): SdmHalfInningEvent {
  return {
    sequence: 1,
    playIndex: 10,
    eventType: "home_run",
    outsBefore: 0,
    outsAfter: 0,
    baseStateBefore: { first: false, second: false, third: false },
    baseStateAfter: { first: false, second: false, third: false },
    scoreBefore: { home: 0, away: 0 },
    runsScoredOnPlay: 1,
    scoreChange: { home: 0, away: 1 },
    movements: [
      {
        runner: { id: "judge", name: "A Judge" },
        from: "home",
        to: "home",
        style: "score",
      },
    ],
    revealType: "plate_appearance",
    result: makeResult(),
    matchup: makeMatchup(),
    isSelected: true,
    ...overrides,
  };
}

function makeContainer(
  overrides: Partial<SdmHalfInningContainer> = {},
): SdmHalfInningContainer {
  return {
    gameId: "12345",
    inning: 1,
    half: "top",
    battingTeam: AWAY_TEAM,
    fieldingTeam: HOME_TEAM,
    events: [makeEvent()],
    meta: { scoredRuns: 1, hadActivity: true, hadLeadChange: true, hadTying: false },
    selectedPlayIndices: [10],
    ...overrides,
  };
}

function buildDeck(
  playOverrides: Record<string, unknown> = {},
  visualOverrides?: Record<string, unknown>,
  options: {
    halfInnings?: SdmHalfInningContainer[] | undefined;
    eventOverrides?: Partial<SdmHalfInningEvent>;
  } = {},
): SdmDeckResponse {
  // Default halfInnings track the default play card. Callers can pass
  // `halfInnings: undefined` (explicit key present) to exercise the
  // legacy (no-container) path, or pass `eventOverrides` to tweak the
  // default event without rebuilding the whole container by hand.
  const explicitHalfInnings = "halfInnings" in options;
  const halfInnings = explicitHalfInnings
    ? options.halfInnings
    : [
        makeContainer({
          events: [
            makeEvent({
              ...(options.eventOverrides ?? {}),
            }),
          ],
        }),
      ];

  return {
    gameId: "12345",
    deckVersion: "v1",
    generatedAt: "2026-05-10T00:00:00Z",
    isFinal: false,
    spoilerPolicy: "pre_reveal",
    homeTeam: HOME_TEAM,
    awayTeam: AWAY_TEAM,
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
          intensity: "high",
          animationProfile: "home_run",
          ...(visualOverrides ?? {}),
        },
        leverageTier: 1,
      },
    ],
    halfInnings,
    plannerReport: null,
    validationWarnings: [],
  };
}


// ── Tests ───────────────────────────────────────────────────


describe("scroll-down-mlb deck adapter — wire-event sourcing", () => {
  it("reads batter name from event.matchup.batter.name (not from movement inference)", () => {
    const deck = buildDeck({}, undefined, {
      eventOverrides: {
        matchup: { batter: { id: "p123", name: "J Soto" }, pitcher: null },
        // Movement-inference path would have picked "Aaron Judge" from
        // the visual movement. Wire matchup must win.
        movements: [
          {
            runner: { id: null, name: "Aaron Judge" },
            from: "home",
            to: "home",
            style: "score",
          },
        ],
      },
    });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBe("J Soto");
  });

  it("passes event.movements through as runnerAdvances without re-derivation", () => {
    const movements: SdmBaseMovement[] = [
      {
        runner: { id: "judge", name: "A Judge" },
        from: "home",
        to: "first",
        style: "advance",
      },
      {
        runner: { id: "betts", name: "M Betts" },
        from: "first",
        to: "second",
        style: "advance",
      },
    ];
    const deck = buildDeck(
      { eventType: "single", description: "Single to right." },
      undefined,
      { eventOverrides: { movements, eventType: "single" } },
    );
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.runnerAdvances).toHaveLength(2);
    expect(play.runnerAdvances?.[0]).toMatchObject({
      from: "home",
      to: "first",
      runnerId: "judge",
      runnerName: "A Judge",
    });
    expect(play.runnerAdvances?.[1]).toMatchObject({
      from: "first",
      to: "second",
      runnerId: "betts",
      runnerName: "M Betts",
    });
  });

  it("passes outAt through on out movements", () => {
    const deck = buildDeck(
      { eventType: "fielders_choice", description: "Forceout at second." },
      undefined,
      {
        eventOverrides: {
          eventType: "fielders_choice",
          movements: [
            {
              runner: { id: "r1", name: "X Runner" },
              from: "first",
              to: "out",
              style: "out",
              outAt: "second",
            },
            {
              runner: { id: "b1", name: "B Batter" },
              from: "home",
              to: "first",
              style: "advance",
            },
          ],
        },
      },
    );
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    const outMove = play.runnerAdvances?.find((m) => m.to === "out");
    expect(outMove?.outAt).toBe("second");
  });

  it("preview shows event.before bases/outs/score from the wire event", () => {
    const deck = buildDeck(
      {
        // Make the PlayPayload before-state intentionally different
        // from the event before-state so we can verify the adapter
        // reads from the event when both are present.
        outsBefore: 99,
        baseStateBefore: { first: true, second: true, third: true },
        scoreBefore: { home: 99, away: 99 },
      },
      undefined,
      {
        eventOverrides: {
          outsBefore: 1,
          baseStateBefore: { first: true, second: false, third: false },
          scoreBefore: { home: 2, away: 3 },
        },
      },
    );
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    // Renderer reads situationBefore.* during preview phase. These must
    // come from the wire event, not the legacy PlayPayload fields.
    expect(play.situationBefore.outs).toBe(1);
    expect(play.situationBefore.baseState).toEqual({
      first: true,
      second: false,
      third: false,
    });
    expect(play.scoreBefore).toEqual({ home: 2, away: 3 });
  });

  it("preview shows event.before.count (balls/strikes) from PlayPayload", () => {
    const deck = buildDeck({ ballsBefore: 2, strikesBefore: 1 });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.balls).toBe(2);
    expect(play.situationBefore.strikes).toBe(1);
  });

  it("preview does NOT apply scoreChange — scoreBefore is unchanged", () => {
    const deck = buildDeck({}, undefined, {
      eventOverrides: {
        scoreBefore: { home: 1, away: 1 },
        scoreChange: { home: 0, away: 3 }, // big delta — would distort preview if applied
      },
    });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    // The renderer renders `scoreBefore` during preview. The adapter
    // surfaces it untouched: scoreChange is only applied on the
    // computed `scoreAfter`.
    expect(play.scoreBefore).toEqual({ home: 1, away: 1 });
  });

  it("revealed phase: scoreAfter = scoreBefore + scoreChange (never reads after-state score)", () => {
    const deck = buildDeck({}, undefined, {
      eventOverrides: {
        scoreBefore: { home: 2, away: 1 },
        scoreChange: { home: 0, away: 2 },
      },
    });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.scoreAfter).toEqual({ home: 2, away: 3 });
  });

  it("revealed phase shows event.after bases/outs from the wire event", () => {
    const deck = buildDeck(
      {
        outsAfter: 99,
        baseStateAfter: { first: false, second: false, third: false },
      },
      undefined,
      {
        eventOverrides: {
          outsAfter: 2,
          baseStateAfter: { first: false, second: true, third: false },
        },
      },
    );
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.outsAfter).toBe(2);
    expect(play.baseStateAfter).toEqual({
      first: false,
      second: true,
      third: false,
    });
  });

  it("uses result.label as chipPrimary when available", () => {
    const deck = buildDeck({ label: "Old chip" }, undefined, {
      eventOverrides: { result: makeResult({ label: "NEW CHIP" }) },
    });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.chipPrimary).toBe("NEW CHIP");
  });

  it("falls back to PlayPayload fields and base diffs when halfInnings is absent (legacy compat)", () => {
    const deck = buildDeck(
      {
        batterName: "Bo Bichette",
        eventType: "single",
        baseStateBefore: { first: false, second: false, third: true },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: { third: "A Judge" },
        runnerNamesAfter: { first: "Bo Bichette" },
      },
      undefined,
      { halfInnings: undefined },
    );
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBe("Bo Bichette");
    expect(play.runnerAdvances).toEqual([
      expect.objectContaining({ from: "third", to: "home" }),
      expect.objectContaining({ from: "home", to: "first" }),
    ]);
  });

  it("legacy fallback: batter is undefined when both event and play.batterName are absent", () => {
    const deck = buildDeck({ batterName: null }, undefined, { halfInnings: undefined });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBeUndefined();
  });

  it("propagates suppressMovementLines from visual.displayHints onto the play card", () => {
    const deck = buildDeck({}, {
      displayHints: { suppressMovementLines: true },
    });
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.suppressMovementLines).toBe(true);
  });

  it("leaves suppressMovementLines undefined when backend has not opted in", () => {
    const { cards } = adaptDeck(buildDeck({}));
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.suppressMovementLines).toBeUndefined();
  });
});


describe("scroll-down-mlb deck adapter — last play index", () => {
  it("uses the highest playIndex across half-inning containers", () => {
    const deck = buildDeck({}, undefined, {
      halfInnings: [
        makeContainer({ events: [makeEvent({ playIndex: 1001 })] }),
        makeContainer({
          inning: 1,
          half: "bottom",
          events: [
            makeEvent({ playIndex: 1004 }),
            makeEvent({ playIndex: 1007 }),
          ],
        }),
      ],
    });
    const adapted = adaptDeck(deck);
    expect(adapted.lastPlayIndex).toBe(1007);
  });

  it("does not substitute an event-count cursor for sparse play indexes", () => {
    const deck = buildDeck({}, undefined, {
      halfInnings: [
        makeContainer({
          events: [
            makeEvent({ playIndex: 90064 }),
            makeEvent({ playIndex: 90078, sequence: 2 }),
          ],
        }),
      ],
    });

    const adapted = adaptDeck(deck);

    expect(adapted.lastPlayIndex).toBe(90078);
  });

  it("advances when a new higher playIndex is appended to a container", () => {
    const baseContainer = makeContainer({
      events: [makeEvent({ playIndex: 105074 })],
    });
    const before = adaptDeck(buildDeck({}, undefined, { halfInnings: [baseContainer] }));
    expect(before.lastPlayIndex).toBe(105074);

    const grown: SdmHalfInningContainer = {
      ...baseContainer,
      events: [...baseContainer.events, makeEvent({ playIndex: 105080, sequence: 2 })],
    };
    const after = adaptDeck(buildDeck({}, undefined, { halfInnings: [grown] }));
    expect(after.lastPlayIndex).toBe(105080);
  });

  it("falls back to deck.lastPlayIndex when halfInnings is missing", () => {
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
    deck.lastPlayIndex = 42;
    const adapted = adaptDeck(deck);
    expect(adapted.lastPlayIndex).toBe(42);
  });

  it("returns -1 when both halfInnings and deck.lastPlayIndex are absent", () => {
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
    deck.lastPlayIndex = undefined;
    const adapted = adaptDeck(deck);
    expect(adapted.lastPlayIndex).toBe(-1);
  });
});


describe("scroll-down-mlb deck adapter — narrative splice", () => {
  it("splices the wire-resolved batter into the curated narrative when narrator left 'the batter' placeholder", () => {
    const { cards } = adaptDeck(buildDeck({}));
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    // Default batter is "A Judge" — narrative splice should drop the
    // last name into the curated copy.
    expect(play.description).toBe("Judge goes deep for a solo home run.");
  });

  it("preserves curated narrative untouched when it already names the batter", () => {
    const deck = buildDeck({});
    const direct = adaptDeck({
      ...deck,
      cards: [
        {
          ...deck.cards[0],
          description: "Judge crushes one to deep left.",
        },
      ],
    });
    const card = direct.cards.find((c) => c.kind === "play");
    if (card?.kind !== "play") throw new Error("expected play card");
    expect(card.description).toBe("Judge crushes one to deep left.");
  });

  it("falls back to raw play.description when narrator left a placeholder and no batter can be resolved", () => {
    const deck = buildDeck(
      {},
      undefined,
      {
        eventOverrides: { matchup: { batter: null, pitcher: null } },
      },
    );
    // Also clear play.batterName so the legacy fallback can't resolve.
    deck.cards[0].play!.batterName = null;
    const { cards } = adaptDeck(deck);
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.situationBefore.batterName).toBeUndefined();
    expect(play.description).toBe(
      "Aaron Judge homers on a fly ball to center field.",
    );
  });
});


describe("scroll-down-mlb deck adapter — foul-side inference", () => {
  it("infers foul_right when the play description mentions first base / right field", () => {
    const { cards } = adaptDeck(
      buildDeck(
        {
          eventType: "field_out",
          description: "Aaron Judge pops out to first baseman Pete Alonso in foul territory.",
        },
        { trajectory: "foul", animationProfile: "foul" },
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
        { trajectory: "foul", animationProfile: "foul" },
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
        { trajectory: "foul", animationProfile: "foul" },
      ),
    );
    const play = cards.find((c) => c.kind === "play");
    if (play?.kind !== "play") throw new Error("expected play card");
    expect(play.ballPath).toBe("foul_left");
  });
});


describe("scroll-down-mlb deck adapter — score carry-forward", () => {
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
    // Default event scores 1 run for the away team.
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
});


// ── priorAfter bridge wiring ────────────────────────────────


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
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
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
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
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

  it("does not attach priorAfter when the prior card is an inning-transition (hard reset)", () => {
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
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
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
    const { cards } = adaptDeck(deck);
    const first = cards.find((c) => c.kind === "play");
    if (first?.kind !== "play") throw new Error("expected play card");
    expect(first.priorAfter).toBeUndefined();
  });

  it("first play after a leading scene-setter receives no priorAfter", () => {
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
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
    const deck = buildDeck({}, undefined, { halfInnings: undefined });
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


// ── Bottom-inning HR fixture (regression: score carry-forward) ──


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
    halfInnings: [
      makeContainer({
        gameId: "745406",
        inning: 3,
        half: "bottom",
        battingTeam: {
          id: "1",
          abbreviation: "ARI",
          displayName: "Arizona",
          colorLight: null,
          colorDark: null,
        },
        fieldingTeam: {
          id: "2",
          abbreviation: "LAD",
          displayName: "Los Angeles",
          colorLight: null,
          colorDark: null,
        },
        events: [
          makeEvent({
            playIndex: 42,
            sequence: 1,
            eventType: "home_run",
            outsBefore: 1,
            outsAfter: 1,
            baseStateBefore: { first: false, second: false, third: false },
            baseStateAfter: { first: false, second: false, third: false },
            scoreBefore: { home: 2, away: 1 },
            scoreChange: { home: 1, away: 0 },
            runsScoredOnPlay: 1,
            matchup: {
              batter: { id: "goldy", name: "P Goldschmidt" },
              pitcher: { id: "glasnow", name: "T Glasnow" },
            },
            result: makeResult({
              label: "HOME RUN",
              description: "Solo home run.",
              eventType: "home_run",
            }),
            movements: [
              {
                runner: { id: "goldy", name: "P Goldschmidt" },
                from: "home",
                to: "home",
                style: "score",
              },
            ],
          }),
        ],
      }),
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
    const deck = buildDeck({});
    const dup: SdmDeckCard = { ...deck.cards[0], sortOrder: 2 };
    deck.cards = [deck.cards[0], dup];

    const { cards } = adaptDeck(deck);
    const playCards = cards.filter((c) => c.kind === "play");
    expect(playCards).toHaveLength(1);
    expect(playCards[0].cardId).toBe("p1");
  });
});

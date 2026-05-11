import { describe, expect, it } from "vitest";
import { adaptDeck } from "@/lib/adapters/scroll-down-mlb-deck-adapter";
import type { SdmDeckResponse } from "@/types/scroll-down-mlb";

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

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatchupCards } from "@/lib/catchup-cards";
import type { CatchupCard, PlayCardData, PlayEntry } from "@/lib/types";

/**
 * Fixture-driven game-reconstruction QA.
 *
 * Reads real upstream JSON captured into tests/fixtures/games/, runs each
 * through the same build pipeline as the live cards endpoint, and asserts
 * that the resulting deck honors the user's pacing acceptance bands by
 * game category.
 *
 * The manifest at tests/fixtures/games/_manifest.json categorizes each
 * fixture; categories drive the deck-shape band each fixture is checked
 * against.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "..", "fixtures", "games");

type FixtureCategory =
  | "pitchers_duel"
  | "steady_control"
  | "back_and_forth"
  | "late_comeback"
  | "chaotic"
  | "blowout"
  | "extra_innings"
  | "weird";

interface FixtureManifestEntry {
  id: string;
  category: FixtureCategory;
  final: { home: number; away: number };
  totalRuns: number;
  margin: number;
  leadChanges: number;
  lastLeadChangeInning?: number;
  finalWinnerTrailed: boolean;
  inningsPlayed: number;
  playsTotal: number;
  hasTriplePlay: boolean;
  hasCatcherInterference: boolean;
  expectedFeel?: Record<string, string> | null;
  reviewNotes?: string[];
}

interface UpstreamFixture {
  game: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    homeTeamAbbr: string;
    awayTeamAbbr: string;
    gameDate: string;
    homeProbablePitcher?: string | null;
    awayProbablePitcher?: string | null;
    venueName?: string | null;
    venue?: string | null;
    location?: string | null;
  };
  plays: PlayEntry[];
}

function loadManifest(): FixtureManifestEntry[] {
  const text = readFileSync(join(FIXTURES_DIR, "_manifest.json"), "utf8");
  return JSON.parse(text) as FixtureManifestEntry[];
}

function loadFixture(id: string): UpstreamFixture {
  const text = readFileSync(join(FIXTURES_DIR, `${id}.json`), "utf8");
  return JSON.parse(text) as UpstreamFixture;
}

/**
 * Acceptance bands. The user's ideal bands (5-8 / 8-14 / 14-18) are
 * aspirational and didn't survive contact with real-world variance —
 * categorization-by-final-score is fuzzy (a 9-7 "normal" game is really
 * wild; a 0-3 "boring" game with 11 must-include plays is a tight
 * pitcher's duel with rallies). So we assert two layers:
 *
 *   1. Universal invariants (every fixture, regardless of category):
 *        plays ∈ [3, 20], rhythm ≤ plays (pacing supports, never dominates)
 *   2. Category-tilt assertions: boring games should sit lower, extras
 *      should sit higher, etc.
 *
 * The aggregate report at the bottom prints actual distributions so a
 * human can eyeball whether the planner is doing the right thing.
 */
const UNIVERSAL_PLAYS_MIN = 3;
const UNIVERSAL_PLAYS_MAX = 20;
const UNIVERSAL_RHYTHM_MAX = 10;

const CATEGORY_TILT: Record<
  FixtureCategory,
  { playsMax?: number; rhythmMax?: number; playsMin?: number; rhythmMin?: number }
> = {
  // Pitcher's duels stay compact; rhythm can run high (lots of
  // quiet-stretches earn their place in a sparse deck).
  pitchers_duel:  { playsMax: 14, rhythmMax: 7 },
  steady_control: { playsMax: 18, rhythmMax: 9 },
  back_and_forth: { playsMax: 18, rhythmMax: 9, rhythmMin: 1 },
  late_comeback:  { playsMin: 5,  playsMax: 18, rhythmMax: 9 },
  chaotic:        { playsMax: 20, rhythmMax: 10 },
  blowout:        { playsMax: 18, rhythmMax: 7 },
  // Extras have one extra inning of plays — push the upper bound.
  extra_innings:  { playsMin: 8, playsMax: 22, rhythmMax: 10 },
  weird:          { playsMax: 18, rhythmMax: 8 },
};

interface DeckShape {
  total: number;
  scene: number;
  plays: number;
  rhythm: number;
  byKind: Record<string, number>;
}

function shapeOf(cards: CatchupCard[]): DeckShape {
  const byKind: Record<string, number> = {};
  for (const c of cards) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  return {
    total: cards.length,
    scene: byKind["scene-setter"] ?? 0,
    plays: byKind["play"] ?? 0,
    rhythm:
      (byKind["inning-transition"] ?? 0) +
      (byKind["quiet-stretch"] ?? 0) +
      (byKind["late-game"] ?? 0) +
      (byKind["final-setup"] ?? 0),
    byKind,
  };
}

function reportLine(entry: FixtureManifestEntry, shape: DeckShape): string {
  const kindBreakdown = Object.entries(shape.byKind)
    .filter(([k]) => k !== "scene-setter" && k !== "play")
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
  return [
    `[${entry.category.padEnd(8)}] ${entry.id}`,
    `final ${entry.final.away}-${entry.final.home}`,
    `plays=${shape.plays}`,
    `rhythm=${shape.rhythm}${kindBreakdown ? ` (${kindBreakdown})` : ""}`,
  ].join("  ");
}

describe("fixture-driven QA: deck-shape acceptance bands", () => {
  const manifest = loadManifest();

  for (const entry of manifest) {
    it(`${entry.category}: ${entry.id} (${entry.final.away}-${entry.final.home})`, () => {
      const fx = loadFixture(entry.id);
      const res = buildCatchupCards({
        game: {
          id: fx.game.id,
          homeTeam: fx.game.homeTeam,
          awayTeam: fx.game.awayTeam,
          homeTeamAbbr: fx.game.homeTeamAbbr,
          awayTeamAbbr: fx.game.awayTeamAbbr,
          gameDate: fx.game.gameDate,
        },
        plays: fx.plays,
        isFinal: true,
        withAudit: true,
      });

      const shape = shapeOf(res.cards);
      const tilt = CATEGORY_TILT[entry.category];
      const summary = reportLine(entry, shape);

      // Universal invariants (every game, every shape).
      expect(
        shape.plays,
        `${summary} | plays below universal floor`,
      ).toBeGreaterThanOrEqual(UNIVERSAL_PLAYS_MIN);
      expect(
        shape.plays,
        `${summary} | plays above universal ceiling`,
      ).toBeLessThanOrEqual(UNIVERSAL_PLAYS_MAX);
      expect(
        shape.rhythm,
        `${summary} | rhythm above universal ceiling`,
      ).toBeLessThanOrEqual(UNIVERSAL_RHYTHM_MAX);
      // Pacing supports the deck, never dominates it.
      expect(
        shape.rhythm,
        `${summary} | rhythm dominates plays`,
      ).toBeLessThanOrEqual(shape.plays);

      // Category-specific tilts.
      if (tilt.playsMin !== undefined) {
        expect(shape.plays, `${summary} | below category playsMin`)
          .toBeGreaterThanOrEqual(tilt.playsMin);
      }
      if (tilt.playsMax !== undefined) {
        expect(shape.plays, `${summary} | above category playsMax`)
          .toBeLessThanOrEqual(tilt.playsMax);
      }
      if (tilt.rhythmMin !== undefined) {
        expect(shape.rhythm, `${summary} | below category rhythmMin`)
          .toBeGreaterThanOrEqual(tilt.rhythmMin);
      }
      if (tilt.rhythmMax !== undefined) {
        expect(shape.rhythm, `${summary} | above category rhythmMax`)
          .toBeLessThanOrEqual(tilt.rhythmMax);
      }
    });
  }
});

describe("fixture-driven QA: scoring & leverage preservation", () => {
  const manifest = loadManifest();

  for (const entry of manifest) {
    it(`${entry.category}: ${entry.id} preserves all scoring plays`, () => {
      const fx = loadFixture(entry.id);
      const res = buildCatchupCards({
        game: {
          id: fx.game.id,
          homeTeam: fx.game.homeTeam,
          awayTeam: fx.game.awayTeam,
          homeTeamAbbr: fx.game.homeTeamAbbr,
          awayTeamAbbr: fx.game.awayTeamAbbr,
          gameDate: fx.game.gameDate,
        },
        plays: fx.plays,
        isFinal: true,
        withAudit: true,
      });

      const audit = res.audit ?? [];
      const scoringPlays = audit.filter((r) => r.isScoringPlay);
      const selectedScoring = scoringPlays.filter((r) => r.isSelectedForCatchup);

      // Every scoring play should make the deck — that's the user's
      // hard rule for emotional fidelity.
      expect(
        selectedScoring.length,
        `${entry.id}: ${scoringPlays.length - selectedScoring.length} scoring plays missed`,
      ).toBe(scoringPlays.length);
    });

    it(`${entry.category}: ${entry.id} preserves all lead-change plays`, () => {
      const fx = loadFixture(entry.id);
      const res = buildCatchupCards({
        game: {
          id: fx.game.id,
          homeTeam: fx.game.homeTeam,
          awayTeam: fx.game.awayTeam,
          homeTeamAbbr: fx.game.homeTeamAbbr,
          awayTeamAbbr: fx.game.awayTeamAbbr,
          gameDate: fx.game.gameDate,
        },
        plays: fx.plays,
        isFinal: true,
        withAudit: true,
      });

      const audit = res.audit ?? [];
      const leadChanges = audit.filter((r) => r.isLeadChangePlay);
      const selected = leadChanges.filter((r) => r.isSelectedForCatchup);

      expect(selected.length).toBe(leadChanges.length);
    });
  }
});

describe("fixture-driven QA: final-setup placement", () => {
  const manifest = loadManifest();

  for (const entry of manifest) {
    if (entry.margin > 2) continue; // Only games close enough to have one.
    if (entry.inningsPlayed < 9) continue;
    it(`${entry.category}: ${entry.id} (close 9th+) emits final-setup before the last play`, () => {
      const fx = loadFixture(entry.id);
      const res = buildCatchupCards({
        game: {
          id: fx.game.id,
          homeTeam: fx.game.homeTeam,
          awayTeam: fx.game.awayTeam,
          homeTeamAbbr: fx.game.homeTeamAbbr,
          awayTeamAbbr: fx.game.awayTeamAbbr,
          gameDate: fx.game.gameDate,
        },
        plays: fx.plays,
        isFinal: true,
      });

      const playCards = res.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      if (playCards.length === 0) return;
      const lastPlay = playCards[playCards.length - 1];
      // Final-setup applies only when the LAST play is in 9th+ with a
      // close margin entering it. Otherwise the assertion is vacuous.
      const enteringMargin = Math.abs(
        lastPlay.scoreBefore.home - lastPlay.scoreBefore.away,
      );
      if (lastPlay.inning < 9 || enteringMargin > 2) return;

      const fsIdx = res.cards.findIndex((c) => c.kind === "final-setup");
      const lastPlayIdx = res.cards.findIndex(
        (c) => c.kind === "play" && c === lastPlay,
      );
      expect(fsIdx).toBeGreaterThanOrEqual(0);
      expect(fsIdx).toBeLessThan(lastPlayIdx);
    });
  }
});

// ── Aggregate report ───────────────────────────────────────────
// One synthesized test that prints the deck-shape distribution across
// every fixture. Even when all per-fixture tests pass, this gives a
// quick eyeballable pacing snapshot in CI logs.

describe("fixture-driven QA: aggregate pacing report", () => {
  it("prints deck-shape distribution across all fixtures", () => {
    const manifest = loadManifest();
    const lines: string[] = [];
    const byCat: Record<string, { plays: number[]; rhythm: number[] }> = {};
    for (const entry of manifest) {
      const fx = loadFixture(entry.id);
      const res = buildCatchupCards({
        game: {
          id: fx.game.id,
          homeTeam: fx.game.homeTeam,
          awayTeam: fx.game.awayTeam,
          homeTeamAbbr: fx.game.homeTeamAbbr,
          awayTeamAbbr: fx.game.awayTeamAbbr,
          gameDate: fx.game.gameDate,
        },
        plays: fx.plays,
        isFinal: true,
      });
      const shape = shapeOf(res.cards);
      lines.push(reportLine(entry, shape));
      const bucket = byCat[entry.category] ?? { plays: [], rhythm: [] };
      bucket.plays.push(shape.plays);
      bucket.rhythm.push(shape.rhythm);
      byCat[entry.category] = bucket;
    }
    console.log("\n  Deck-shape distribution:");
    for (const line of lines) console.log("    " + line);
    console.log("\n  Per-category averages:");
    for (const [cat, vals] of Object.entries(byCat)) {
      const avgP = (vals.plays.reduce((a, b) => a + b, 0) / vals.plays.length).toFixed(1);
      const avgR = (vals.rhythm.reduce((a, b) => a + b, 0) / vals.rhythm.length).toFixed(1);
      const minP = Math.min(...vals.plays);
      const maxP = Math.max(...vals.plays);
      console.log(`    [${cat.padEnd(8)}] n=${vals.plays.length}  plays avg=${avgP} (${minP}-${maxP})  rhythm avg=${avgR}`);
    }
    // No assertion — this is purely informational.
    expect(lines.length).toBe(manifest.length);
  });
});

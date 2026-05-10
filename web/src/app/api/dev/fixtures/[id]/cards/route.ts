import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildCatchupCards,
  type UpstreamBatter,
  type UpstreamPitcher,
} from "@/lib/catchup-cards";
import { planDeckWithReport, summarizeHalfInnings } from "@/lib/rhythm-planner";
import { computeTimeline, toPlayCard, buildSceneSetter } from "@/lib/catchup-cards";
import type { PlayCardData, PlayEntry } from "@/lib/types";

/**
 * Dev-only: run a captured fixture through the same build pipeline as the
 * live cards endpoint, returning the deck + audit table + planner report.
 *
 * The lab page uses this to render real deck visuals alongside the
 * planner's reasoning, so qualitative review can compare the two.
 */

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
  /** Optional — present on fixtures captured with the latest schema; the
   *  lab gracefully degrades when absent (matchup row hides pitcher). */
  mlbPitchers?: UpstreamPitcher[];
  mlbBatters?: UpstreamBatter[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { id } = await params;
  if (!/^[0-9]+$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const fixturePath = join(
    process.cwd(),
    "tests",
    "fixtures",
    "games",
    `${id}.json`,
  );
  if (!existsSync(fixturePath)) {
    return NextResponse.json({ error: "fixture not found" }, { status: 404 });
  }

  let fx: UpstreamFixture;
  try {
    fx = JSON.parse(readFileSync(fixturePath, "utf8")) as UpstreamFixture;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "parse error" },
      { status: 500 },
    );
  }

  const gameInput = {
    id: fx.game.id,
    homeTeam: fx.game.homeTeam,
    awayTeam: fx.game.awayTeam,
    homeTeamAbbr: fx.game.homeTeamAbbr,
    awayTeamAbbr: fx.game.awayTeamAbbr,
    gameDate: fx.game.gameDate,
  };

  // Run the production build pipeline for the deck + audit.
  const cardsResp = buildCatchupCards({
    game: gameInput,
    homeProbablePitcher: fx.game.homeProbablePitcher ?? null,
    awayProbablePitcher: fx.game.awayProbablePitcher ?? null,
    venue: fx.game.venueName ?? fx.game.venue ?? fx.game.location ?? null,
    plays: fx.plays,
    mlbPitchers: fx.mlbPitchers,
    mlbBatters: fx.mlbBatters,
    isFinal: true,
    withAudit: true,
  });

  // Re-run just the planner to capture its decision report alongside the
  // deck. The deck on `cardsResp.cards` and `report.deck` are identical
  // (deterministic given the same inputs); we expose `report` for
  // qualitative review.
  const timeline = computeTimeline(fx.plays, gameInput.homeTeamAbbr);
  // Replicate the play-card build step so we have the same selected
  // PlayCardData[] the planner saw.
  const playCards: PlayCardData[] = [];
  const seen = new Set(
    cardsResp.cards
      .filter((c): c is PlayCardData => c.kind === "play")
      .map((c) => c.playIndex),
  );
  for (const play of fx.plays) {
    if (!seen.has(play.playIndex)) continue;
    const t = timeline.get(play.playIndex);
    if (!t) continue;
    playCards.push(toPlayCard(gameInput.id, 0, play, t));
  }
  const halfInningMeta = summarizeHalfInnings(timeline.values());
  const { report } = planDeckWithReport({
    scene: buildSceneSetter({ game: gameInput }),
    playCards,
    halfInningMeta,
    homeTeamAbbr: gameInput.homeTeamAbbr,
    awayTeamAbbr: gameInput.awayTeamAbbr,
  });

  return NextResponse.json({
    gameId: cardsResp.gameId,
    isFinal: cardsResp.isFinal,
    cards: cardsResp.cards,
    audit: cardsResp.audit ?? [],
    report,
    finalScore: (fx as unknown as { game: { score?: { home?: number; away?: number } } }).game.score ?? null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import {
  buildCatchupCards,
  isValidCard,
  type UpstreamPitcher,
} from "@/lib/catchup-cards";
import { API } from "@/lib/config";
import { isFinal as isFinalStatus } from "@/lib/types";
import type { GameStatus, PlayEntry } from "@/lib/types";

/**
 * Upstream shape the proxy reads. We pull only what's needed to build cards.
 * Anything else on the upstream payload is ignored (and never returned).
 */
interface UpstreamGameDetail {
  game: {
    id: number;
    leagueCode?: string;
    gameDate: string;
    localGameDate?: string;
    status: GameStatus;
    homeTeam: string;
    awayTeam: string;
    homeTeamAbbr?: string;
    awayTeamAbbr?: string;
    isFinal?: boolean;
    homeProbablePitcher?: string | null;
    awayProbablePitcher?: string | null;
    /** Any of these may carry a venue label depending on upstream version. */
    venueName?: string | null;
    venue?: string | null;
    location?: string | null;
  };
  plays: PlayEntry[];
  /** Per-pitcher game lines — used to reconstruct pitcher of record per
   *  play. Optional; absent on live games before the box is settled. */
  mlbPitchers?: UpstreamPitcher[];
}

function readVenue(g: UpstreamGameDetail["game"]): string | null {
  return g.venueName ?? g.venue ?? g.location ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId: gameIdStr } = await params;
  const gameId = Number(gameIdStr);
  if (!Number.isFinite(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  const sincePlayIndex = sinceParam !== null ? Number(sinceParam) : undefined;
  const withAudit = req.nextUrl.searchParams.get("debug") === "true";

  try {
    const { data, cacheStatus } = await cachedApiFetch<UpstreamGameDetail>(
      `cards:${gameId}`,
      `/api/admin/sports/games/${gameId}`,
      {
        revalidate: 0,
        // The route is hit twice in a live game's lifecycle — short cache
        // while live, long cache once final (immutable content).
        freshMs: API.CARDS_LIVE_BFF_FRESH_MS,
        staleMs: API.CARDS_LIVE_BFF_STALE_MS,
      },
    );

    if (data.game?.leagueCode && data.game.leagueCode.toLowerCase() !== "mlb") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const finalGame = isFinalStatus(data.game.status, data.game);
    const response = buildCatchupCards({
      game: {
        id: data.game.id,
        homeTeam: data.game.homeTeam,
        awayTeam: data.game.awayTeam,
        homeTeamAbbr: data.game.homeTeamAbbr,
        awayTeamAbbr: data.game.awayTeamAbbr,
        gameDate: data.game.gameDate,
      },
      homeProbablePitcher: data.game.homeProbablePitcher ?? null,
      awayProbablePitcher: data.game.awayProbablePitcher ?? null,
      venue: readVenue(data.game),
      plays: data.plays ?? [],
      mlbPitchers: data.mlbPitchers,
      sincePlayIndex,
      isFinal: finalGame,
      withAudit,
    });

    // Shape sanity check: every card has the fields the UI expects. Catches
    // upstream schema drift before it lands as a render crash.
    if (!response.cards.every(isValidCard)) {
      return NextResponse.json(
        { error: "Card payload failed shape validation" },
        { status: 500 },
      );
    }

    const cacheControl = finalGame
      ? "private, max-age=86400, stale-if-error=604800, immutable"
      : "private, max-age=10, stale-if-error=180";

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": cacheControl,
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch cards" }, { status });
  }
}

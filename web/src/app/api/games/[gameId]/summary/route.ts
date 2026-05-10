import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";
import type { CatchupSummaryResponse, GameStatus } from "@/lib/types";

/**
 * Reveal-time payload. Two upstream sources, composed:
 *
 *  1. Game detail (`/api/admin/sports/games/:id`) — authoritative source of
 *     the final score. We already use this endpoint to build cards, so we
 *     know the shape and that it works.
 *  2. Gameflow narrative — best-effort text recap. If it 404s, returns a
 *     different shape, or just isn't there yet, we still ship the score and
 *     let the client fall back to the MLB.com box-score link.
 *
 * The gameflow path is overridable via SPORTS_GAMEFLOW_PATH so the upstream
 * can move without a code change. Default mirrors the existing detail path.
 */
const DEFAULT_GAMEFLOW_PATH = (id: number) => `/api/admin/sports/games/${id}/gameflow`;

interface UpstreamGameDetail {
  game: {
    id: number;
    leagueCode?: string;
    status: GameStatus;
    homeScore?: number | null;
    awayScore?: number | null;
    score?: { home?: number | null; away?: number | null } | null;
  };
}

interface UpstreamGameflow {
  summary?: string;
  narrative?: string;
  recap?: string;
  text?: string;
  story?: string;
  body?: string;
  // Some backends nest the text under a `data` or `result` object.
  data?: { summary?: string; narrative?: string; text?: string };
  result?: { summary?: string; narrative?: string; text?: string };
}

function readSummary(payload: UpstreamGameflow | null): string {
  if (!payload) return "";
  return (
    payload.summary?.trim() ||
    payload.narrative?.trim() ||
    payload.recap?.trim() ||
    payload.text?.trim() ||
    payload.story?.trim() ||
    payload.body?.trim() ||
    payload.data?.summary?.trim() ||
    payload.data?.narrative?.trim() ||
    payload.data?.text?.trim() ||
    payload.result?.summary?.trim() ||
    payload.result?.narrative?.trim() ||
    payload.result?.text?.trim() ||
    ""
  );
}

function readFinalScore(detail: UpstreamGameDetail): { home: number; away: number } | null {
  const g = detail.game;
  if (!g) return null;
  if (g.score && typeof g.score.home === "number" && typeof g.score.away === "number") {
    return { home: g.score.home, away: g.score.away };
  }
  if (typeof g.homeScore === "number" && typeof g.awayScore === "number") {
    return { home: g.homeScore, away: g.awayScore };
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId: gameIdStr } = await params;
  const gameId = Number(gameIdStr);
  if (!Number.isFinite(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const gameflowPath =
    process.env.SPORTS_GAMEFLOW_PATH?.replace("{id}", String(gameId)) ??
    DEFAULT_GAMEFLOW_PATH(gameId);

  // Detail is the must-have. Gameflow is best-effort — swallow failures so
  // the user always gets a final score even if the recap is missing.
  const detailPromise = cachedApiFetch<UpstreamGameDetail>(
    `summary-detail:${gameId}`,
    `/api/admin/sports/games/${gameId}`,
    {
      revalidate: 0,
      freshMs: API.CARDS_FINAL_BFF_FRESH_MS,
      staleMs: API.CARDS_FINAL_BFF_STALE_MS,
    },
  );
  const gameflowPromise = cachedApiFetch<UpstreamGameflow>(
    `summary-gameflow:${gameId}`,
    gameflowPath,
    {
      revalidate: 0,
      freshMs: API.SUMMARY_BFF_FRESH_MS,
      staleMs: API.SUMMARY_BFF_STALE_MS,
    },
  ).catch((err) => {
    console.warn(`[summary] gameflow fetch failed for ${gameId}: ${err instanceof Error ? err.message : err}`);
    return null;
  });

  try {
    const [detailResult, gameflowResult] = await Promise.all([detailPromise, gameflowPromise]);

    const detail = detailResult.data;
    if (detail.game?.leagueCode && detail.game.leagueCode.toLowerCase() !== "mlb") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const finalScore = readFinalScore(detail);
    if (!finalScore) {
      // No score on the detail payload yet — pregame, or upstream is in a
      // weird state. Tell the client so it can render an honest message.
      return NextResponse.json(
        { error: "Final score not yet available" },
        { status: 409 },
      );
    }

    const winner: CatchupSummaryResponse["winner"] =
      finalScore.home === finalScore.away
        ? "tie"
        : finalScore.home > finalScore.away
          ? "home"
          : "away";

    const response: CatchupSummaryResponse = {
      gameId,
      finalScore,
      winner,
      summary: readSummary(gameflowResult?.data ?? null),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=86400, stale-if-error=604800, immutable",
        "X-SD-Cache": detailResult.cacheStatus,
        "X-SD-Summary-Source": gameflowResult ? "gameflow" : "fallback",
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch summary" }, { status });
  }
}

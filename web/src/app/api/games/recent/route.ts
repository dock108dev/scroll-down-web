import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import { addDaysCalendar, easternCalendarToday } from "@/lib/date-utils";
import { filterOutTbdGames } from "@/lib/game-filters";
import { API, LEAGUE } from "@/lib/config";
import type { GameListResponse, GameSummary } from "@/lib/types";

/**
 * Spoiler-free home feed: every MLB game whose first pitch falls within the
 * last 48 hours, plus today's later games. The proxy strips every score and
 * win-state field so even the network panel never reveals an outcome.
 */
function stripScoreFields(game: Record<string, unknown>): GameSummary {
  // Allowlist projection — anything not listed here is dropped before we
  // hand the payload back to the client.
  return {
    id: Number(game.id),
    leagueCode: String(game.leagueCode ?? "mlb"),
    gameDate: String(game.gameDate),
    localGameDate: typeof game.localGameDate === "string" ? game.localGameDate : undefined,
    status: game.status as GameSummary["status"],
    homeTeam: String(game.homeTeam ?? ""),
    awayTeam: String(game.awayTeam ?? ""),
    homeTeamColorLight: typeof game.homeTeamColorLight === "string" ? game.homeTeamColorLight : undefined,
    homeTeamColorDark: typeof game.homeTeamColorDark === "string" ? game.homeTeamColorDark : undefined,
    awayTeamColorLight: typeof game.awayTeamColorLight === "string" ? game.awayTeamColorLight : undefined,
    awayTeamColorDark: typeof game.awayTeamColorDark === "string" ? game.awayTeamColorDark : undefined,
    homeTeamAbbr: typeof game.homeTeamAbbr === "string" ? game.homeTeamAbbr : undefined,
    awayTeamAbbr: typeof game.awayTeamAbbr === "string" ? game.awayTeamAbbr : undefined,
    isLive: typeof game.isLive === "boolean" ? game.isLive : undefined,
    isFinal: typeof game.isFinal === "boolean" ? game.isFinal : undefined,
    isPregame: typeof game.isPregame === "boolean" ? game.isPregame : undefined,
    keyPlayCount: typeof game.keyPlayCount === "number" ? game.keyPlayCount : undefined,
    lastPlayIndex: typeof game.lastPlayIndex === "number" ? game.lastPlayIndex : undefined,
  };
}

export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const today = easternCalendarToday();
  const startDate = incoming.get("startDate") ?? addDaysCalendar(today, -2);
  const endDate = incoming.get("endDate") ?? today;

  const fwd = new URLSearchParams();
  fwd.set("startDate", startDate);
  fwd.set("endDate", endDate);
  fwd.set("limit", String(API.GAMES_LIMIT));
  fwd.set("league", LEAGUE);
  if (incoming.get("team")) fwd.set("team", incoming.get("team")!);

  const qs = fwd.toString();
  const path = `/api/admin/sports/games?${qs}`;
  const cacheKey = `games:recent:${qs}`;

  try {
    const { data, cacheStatus } = await cachedApiFetch<GameListResponse>(
      cacheKey,
      path,
      {
        revalidate: 0,
        freshMs: API.GAMES_BFF_FRESH_MS,
        staleMs: API.GAMES_BFF_STALE_MS,
      },
    );

    const sanitized: GameListResponse = {
      games: filterOutTbdGames(
        (data.games ?? []).map((g) => stripScoreFields(g as unknown as Record<string, unknown>)),
      ),
    };

    return NextResponse.json(sanitized, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-if-error=300",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch games" }, { status });
  }
}

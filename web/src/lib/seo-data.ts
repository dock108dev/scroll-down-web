import { apiFetch } from "@/lib/api-server";
import { addDaysCalendar, easternCalendarToday } from "@/lib/date-utils";
import { filterOutTbdGames } from "@/lib/game-filters";
import { LEAGUE } from "@/lib/config";
import type { GameListResponse, GameSummary } from "@/lib/types";

export const SEO_REVALIDATE_SECONDS = 60;
export const SEO_FETCH_TIMEOUT_MS = 5_000;

interface GameWindowOptions {
  startDate: string;
  endDate: string;
  limit?: number;
}

/**
 * SEO-time game fetch for the home page. Goes straight to the upstream API
 * with the same MLB lock the proxy uses, then drops every score-revealing
 * field before handing the list to the renderer. Even server-rendered HTML
 * never carries a final score.
 */
async function fetchSeoGameWindow({
  startDate,
  endDate,
  limit = 200,
}: GameWindowOptions): Promise<GameSummary[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    limit: String(limit),
    league: LEAGUE,
  });
  const data = await apiFetch<GameListResponse & { games: Array<Record<string, unknown>> }>(
    `/api/admin/sports/games?${params}`,
    {
      revalidate: SEO_REVALIDATE_SECONDS,
      timeoutMs: SEO_FETCH_TIMEOUT_MS,
    },
  );
  const games: GameSummary[] = (data.games ?? []).map((g) => ({
    id: Number(g.id),
    leagueCode: String(g.leagueCode ?? "mlb"),
    gameDate: String(g.gameDate),
    localGameDate: typeof g.localGameDate === "string" ? g.localGameDate : undefined,
    status: g.status as GameSummary["status"],
    homeTeam: String(g.homeTeam ?? ""),
    awayTeam: String(g.awayTeam ?? ""),
    homeTeamColorLight: typeof g.homeTeamColorLight === "string" ? g.homeTeamColorLight : undefined,
    homeTeamColorDark: typeof g.homeTeamColorDark === "string" ? g.homeTeamColorDark : undefined,
    awayTeamColorLight: typeof g.awayTeamColorLight === "string" ? g.awayTeamColorLight : undefined,
    awayTeamColorDark: typeof g.awayTeamColorDark === "string" ? g.awayTeamColorDark : undefined,
    homeTeamAbbr: typeof g.homeTeamAbbr === "string" ? g.homeTeamAbbr : undefined,
    awayTeamAbbr: typeof g.awayTeamAbbr === "string" ? g.awayTeamAbbr : undefined,
    isLive: typeof g.isLive === "boolean" ? g.isLive : undefined,
    isFinal: typeof g.isFinal === "boolean" ? g.isFinal : undefined,
    isPregame: typeof g.isPregame === "boolean" ? g.isPregame : undefined,
  }));
  return filterOutTbdGames(games);
}

export async function fetchHomeSeoGames(): Promise<GameSummary[]> {
  const today = easternCalendarToday();
  return fetchSeoGameWindow({
    startDate: addDaysCalendar(today, -2),
    endDate: today,
    limit: 200,
  });
}

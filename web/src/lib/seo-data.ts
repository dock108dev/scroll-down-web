import { apiFetch } from "@/lib/api-server";
import { addDays, easternToday, fmtDate } from "@/lib/date-utils";
import type { GameListResponse, GameSummary } from "@/lib/types";

export const SEO_REVALIDATE_SECONDS = 60;
export const SEO_FETCH_TIMEOUT_MS = 5_000;

export interface GameWindowOptions {
  startDate: string;
  endDate: string;
  league?: string;
  limit?: number;
}

export async function fetchSeoGameWindow({
  startDate,
  endDate,
  league,
  limit = 500,
}: GameWindowOptions): Promise<GameSummary[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    limit: String(limit),
  });
  if (league) params.set("league", league);
  const data = await apiFetch<GameListResponse>(
    `/api/admin/sports/games?${params}`,
    {
      revalidate: SEO_REVALIDATE_SECONDS,
      timeoutMs: SEO_FETCH_TIMEOUT_MS,
    },
  );
  return data.games;
}

export async function fetchSeoGamesForDate(date: string, league?: string): Promise<GameSummary[]> {
  return fetchSeoGameWindow({ startDate: date, endDate: date, league });
}

export async function fetchRollingSeoGames(pastDays = 14, futureDays = 7): Promise<GameSummary[]> {
  const today = easternToday();
  return fetchSeoGameWindow({
    startDate: fmtDate(addDays(today, -pastDays)),
    endDate: fmtDate(addDays(today, futureDays)),
    limit: 700,
  });
}

export async function fetchHomeSeoGames(): Promise<GameSummary[]> {
  const today = easternToday();
  return fetchSeoGameWindow({
    startDate: fmtDate(addDays(today, -1)),
    endDate: fmtDate(addDays(today, 2)),
    limit: 200,
  });
}

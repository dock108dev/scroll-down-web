"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getScrollDownMlbRecentGames } from "@/lib/scroll-down-mlb-api";
import type { GameSummary } from "@/lib/types";
import type { SdmRecentGame } from "@/types/scroll-down-mlb";
import { POLLING } from "@/lib/config";

interface UseGamesListReturn {
  games: GameSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Spoiler-free home feed. Hits the SDA-backed
 * `/api/v1/scroll-down-mlb/games/recent` endpoint via the BFF proxy.
 *
 * The SDA endpoint is spoiler-safe by construction (no scores, no
 * winners). We adapt its `SdmRecentGame` shape onto the existing
 * `GameSummary` renderer type — the home grid components were built
 * around `GameSummary`, and rebuilding them is out of scope for the
 * Phase 4 swap.
 */
export function useGamesList(): UseGamesListReturn {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getScrollDownMlbRecentGames({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setGames((data.games ?? []).map(adaptRecentGame));
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load games");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  // Refresh on tab focus.
  useEffect(() => {
    const handler = () => {
      if (typeof document !== "undefined" && !document.hidden) fetchAll();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchAll]);

  // Background poll while visible. fetchAll routes failures into the `error`
  // state already; the bare .catch here exists only to prevent an
  // unhandledrejection bubbling out of the interval callback. The visible
  // error UI is driven by the state set inside fetchAll.
  // See docs/audits/error-handling-report.md §F2.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAll().catch(() => {});
    }, POLLING.GAMES_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { games, loading, error, refetch: fetchAll };
}


function adaptRecentGame(g: SdmRecentGame): GameSummary {
  return {
    id: parseGameIdNumeric(g.gameId),
    leagueCode: "mlb",
    gameDate: g.startTime ?? g.gameDate ?? "",
    localGameDate: g.gameDate ?? undefined,
    status: (g.status ?? "scheduled") as GameSummary["status"],
    homeTeam: g.homeTeam.displayName,
    awayTeam: g.awayTeam.displayName,
    homeTeamAbbr: g.homeTeam.abbreviation,
    awayTeamAbbr: g.awayTeam.abbreviation,
    homeTeamColorLight: g.homeTeam.colorLight ?? undefined,
    homeTeamColorDark: g.homeTeam.colorDark ?? undefined,
    awayTeamColorLight: g.awayTeam.colorLight ?? undefined,
    awayTeamColorDark: g.awayTeam.colorDark ?? undefined,
    isFinal: g.isFinal,
    keyPlayCount: g.hasDeck ? 1 : 0,
  };
}


function parseGameIdNumeric(gameId: string): number {
  const n = Number(gameId);
  return Number.isFinite(n) ? n : 0;
}

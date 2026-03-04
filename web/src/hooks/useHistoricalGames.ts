"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, type GameStatus } from "@/lib/types";

// ── Sorting helpers ────────────────────────────────────────

function statusPriority(status: GameStatus): number {
  if (isLive(status)) return 0;
  if (isFinal(status)) return 2;
  return 1;
}

function sortByStatusThenTime(games: GameCore[]): GameCore[] {
  return [...games].sort((a, b) => {
    const sp = statusPriority(a.status) - statusPriority(b.status);
    if (sp !== 0) return sp;
    return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
  });
}

// ── Hook return type ───────────────────────────────────────

interface UseHistoricalGamesReturn {
  games: GameCore[];
  loading: boolean;
  error: string | null;
  total: number;
  refetch: () => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────

export function useHistoricalGames(
  date: string,
  league?: string,
  team?: string,
): UseHistoricalGamesReturn {
  const cacheKey = `history:${date}:${league ?? ""}`;
  const upsertFromList = useGameData((s) => s.upsertFromList);
  const games = useGameData((s) => s.games);

  const [gameIds, setGameIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Debounce team search
  const [debouncedTeam, setDebouncedTeam] = useState(team);
  const teamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (teamTimerRef.current) clearTimeout(teamTimerRef.current);
    teamTimerRef.current = setTimeout(() => {
      setDebouncedTeam(team);
    }, 300);
    return () => {
      if (teamTimerRef.current) clearTimeout(teamTimerRef.current);
    };
  }, [team]);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("startDate", date);
    params.set("endDate", date);
    params.set("limit", "200");
    if (league) params.set("league", league);
    if (debouncedTeam) params.set("team", debouncedTeam);

    try {
      const data = await api.games(params);
      const summaries = data.games;
      setTotal(data.total ?? summaries.length);

      // Upsert into game data store with history-specific cache key
      upsertFromList(cacheKey, summaries);
      setGameIds(summaries.map((g: GameSummary) => g.id));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch games");
      setLoading(false);
    }
  }, [date, league, debouncedTeam, cacheKey, upsertFromList]);

  // Re-fetch when date/league/team change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on dep change, same pattern as useGamesList
    fetchGames();
  }, [fetchGames]);

  // Derive sorted game list from store
  const sortedGames = useMemo(() => {
    const cores: GameCore[] = [];
    for (const id of gameIds) {
      const entry = games.get(id);
      if (entry) cores.push(entry.core);
    }
    return sortByStatusThenTime(cores);
  }, [gameIds, games]);

  return { games: sortedGames, loading, error, total, refetch: fetchGames };
}

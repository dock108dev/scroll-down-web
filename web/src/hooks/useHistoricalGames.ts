"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";

const PAGE_SIZE = 25;

// ── Hook return type ───────────────────────────────────────

interface UseHistoricalGamesReturn {
  games: GameCore[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  loadMore: () => void;
}

// ── Hook ───────────────────────────────────────────────────

export function useHistoricalGames(
  startDate: string,
  endDate: string,
  league?: string,
  team?: string,
): UseHistoricalGamesReturn {
  const upsertFromList = useGameData((s) => s.upsertFromList);
  const games = useGameData((s) => s.games);

  const [gameIds, setGameIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [, setOffset] = useState(0);

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

  // Track params to detect changes and reset
  const paramsKey = `${startDate}:${endDate}:${league ?? ""}:${debouncedTeam ?? ""}`;
  const prevParamsKey = useRef(paramsKey);

  // Reset when params change
  useEffect(() => {
    if (prevParamsKey.current !== paramsKey) {
      prevParamsKey.current = paramsKey;
      setGameIds([]);
      setOffset(0);
      setTotal(0);
    }
  }, [paramsKey]);

  const fetchPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageOffset));
      if (league) params.set("league", league);
      if (debouncedTeam) params.set("team", debouncedTeam);

      const cacheKey = `history:${startDate}:${endDate}:${league ?? ""}:${pageOffset}`;

      try {
        const data = await api.games(params);
        const summaries = data.games;
        setTotal(data.total ?? summaries.length);

        upsertFromList(cacheKey, summaries);
        const newIds = summaries.map((g: GameSummary) => g.id);

        if (append) {
          setGameIds((prev) => [...prev, ...newIds]);
        } else {
          setGameIds(newIds);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch games");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [startDate, endDate, league, debouncedTeam, upsertFromList],
  );

  // Initial fetch (and re-fetch on param change)
  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const hasMore = gameIds.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextOffset = gameIds.length;
    setOffset(nextOffset);
    fetchPage(nextOffset, true);
  }, [loadingMore, hasMore, gameIds.length, fetchPage]);

  // Derive game list from store (no sorting here — page handles it)
  const gameList = useMemo(() => {
    const cores: GameCore[] = [];
    for (const id of gameIds) {
      const entry = games.get(id);
      if (entry) cores.push(entry.core);
    }
    return cores;
  }, [gameIds, games]);

  return { games: gameList, loading, loadingMore, error, total, hasMore, loadMore };
}

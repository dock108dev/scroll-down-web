"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
import { POLLING } from "@/lib/config";

interface UseGamesListReturn {
  games: GameSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Spoiler-free home feed. Hits `/api/games/recent` (which strips score fields
 * server-side), refreshes when the tab regains focus, and polls in the
 * background while visible. No realtime — completed games don't change and
 * live games update on a 60s cadence which is plenty for a card list view.
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
      const data = await api.recentGames({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setGames(data.games ?? []);
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

  // Background poll while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAll().catch(() => {});
    }, POLLING.GAMES_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { games, loading, error, refetch: fetchAll };
}

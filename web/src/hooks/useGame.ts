"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GameDetailResponse } from "@/lib/types";
import { isLive, isFinal } from "@/lib/types";
import { CACHE, POLLING } from "@/lib/config";

// ─── In-memory cache ───────────────────────────────────────────

interface CacheEntry {
  data: GameDetailResponse;
  fetchedAt: number;
}

const cache = new Map<number, CacheEntry>();

function getCached(id: number): GameDetailResponse | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE.GAME_DETAIL_TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.data;
}

function setCache(id: number, data: GameDetailResponse) {
  // Evict oldest if at capacity
  if (cache.size >= CACHE.GAME_DETAIL_MAX_ENTRIES && !cache.has(id)) {
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.fetchedAt < oldestTime) {
        oldestTime = entry.fetchedAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) cache.delete(oldestKey);
  }
  cache.set(id, { data, fetchedAt: Date.now() });
}

// ─── Polling interval for live games ───────────────────────────

// ─── Hook ──────────────────────────────────────────────────────

export function useGame(id: number) {
  const [data, setData] = useState<GameDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGame = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        // Try cache first (skip for silent/poll refetches)
        if (!opts?.silent) {
          const cached = getCached(id);
          if (cached) {
            setData(cached);
            setLoading(false);
            return cached;
          }
        }
        const result = await api.game(id);
        setCache(id, result);
        setData(result);
        return result;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch game",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  // Initial fetch
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Live polling: start 45-second interval when game is live
  useEffect(() => {
    if (!data) return;

    const gameStatus = data.game.status;

    if (isLive(gameStatus)) {
      // Start polling
      pollRef.current = setInterval(() => {
        fetchGame({ silent: true });
      }, POLLING.LIVE_GAME_POLL_MS);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [data?.game.status, fetchGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop polling once game becomes final
  useEffect(() => {
    if (data && isFinal(data.game.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [data]);

  return { data, loading, error, refetch: fetchGame };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FairbetLiveResponse } from "@/lib/types";

export interface UseFairBetLiveReturn {
  data: FairbetLiveResponse | null;
  loading: boolean;
  error: string | null;
  gameId: number | null;
  marketKey: string;
  setGameId: (id: number | null) => void;
  setMarketKey: (mk: string) => void;
  refetch: () => void;
}

export function useFairBetLive(): UseFairBetLiveReturn {
  const [gameId, setGameId] = useState<number | null>(null);
  const [marketKey, setMarketKey] = useState<string>("");
  const [data, setData] = useState<FairbetLiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    if (gameId === null) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.fairbetLive(
        gameId,
        marketKey || undefined,
        100,
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live odds",
      );
    } finally {
      setLoading(false);
    }
  }, [gameId, marketKey]);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Auto-refresh every 15s while a game is selected
  useEffect(() => {
    if (gameId === null) return;
    const iv = setInterval(fetchLive, 15_000);
    return () => clearInterval(iv);
  }, [gameId, fetchLive]);

  return {
    data,
    loading,
    error,
    gameId,
    marketKey,
    setGameId,
    setMarketKey,
    refetch: fetchLive,
  };
}

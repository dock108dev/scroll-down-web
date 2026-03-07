"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { APIBet, FairbetLiveResponse } from "@/lib/types";
import { enrichBet, betId } from "@/lib/fairbet-utils";
import { FAIRBET } from "@/lib/config";

export interface UseFairBetLiveReturn {
  data: FairbetLiveResponse | null;
  bets: APIBet[];
  loading: boolean;
  error: string | null;
  gameId: number | null;
  marketCategory: string;
  evOnly: boolean;
  hideThin: boolean;
  searchText: string;
  availableMarkets: string[];
  lastUpdatedAt: string | null;
  setGameId: (id: number | null) => void;
  setMarketCategory: (mc: string) => void;
  setEvOnly: (v: boolean) => void;
  setHideThin: (v: boolean) => void;
  setSearchText: (text: string) => void;
  refetch: () => void;
  // Parlay
  toggleParlay: (id: string) => void;
  clearParlay: () => void;
  parlayBetIds: Set<string>;
  parlayBets: APIBet[];
  parlayCount: number;
  canShowParlay: boolean;
}

export function useFairBetLive(): UseFairBetLiveReturn {
  const [gameId, setGameId] = useState<number | null>(null);
  const [marketCategory, setMarketCategory] = useState("");
  const [evOnly, setEvOnly] = useState(false);
  const [hideThin, setHideThin] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [data, setData] = useState<FairbetLiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parlayIds, setParlayIds] = useState<Set<string>>(new Set());

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
        marketCategory || undefined,
      );
      // Enrich bets with display labels
      result.bets = result.bets.map(enrichBet);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live odds",
      );
    } finally {
      setLoading(false);
    }
  }, [gameId, marketCategory]);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Auto-refresh every 15s while a game is selected
  useEffect(() => {
    if (gameId === null) return;
    const iv = setInterval(fetchLive, 15_000);
    return () => clearInterval(iv);
  }, [gameId, fetchLive]);

  // Client-side filtering
  const bets = useMemo(() => {
    if (!data) return [];
    let filtered = data.bets;

    if (evOnly) {
      filtered = filtered.filter((b) => {
        const best = b.books.find((bk) => bk.book === b.bestBook);
        const ev = best?.display_ev ?? best?.ev_percent ?? b.best_ev_percent ?? 0;
        return ev > 0;
      });
    }

    if (hideThin) {
      filtered = filtered.filter((b) => b.books.length >= FAIRBET.MIN_BOOKS);
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          (b.selectionDisplay ?? b.selection_display ?? b.selection_key ?? "").toLowerCase().includes(q) ||
          b.home_team.toLowerCase().includes(q) ||
          b.away_team.toLowerCase().includes(q) ||
          (b.player_name ?? "").toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [data, evOnly, hideThin, searchText]);

  const availableMarkets = useMemo(
    () => data?.market_categories_available ?? [],
    [data],
  );

  const lastUpdatedAt = data?.last_updated_at ?? null;

  // Parlay
  const allBetsById = useMemo(() => {
    const map = new Map<string, APIBet>();
    if (data) {
      for (const b of data.bets) map.set(betId(b), b);
    }
    return map;
  }, [data]);

  const toggleParlay = useCallback((id: string) => {
    setParlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearParlay = useCallback(() => setParlayIds(new Set()), []);

  const parlayBets = useMemo(
    () => Array.from(parlayIds).map((id) => allBetsById.get(id)).filter(Boolean) as APIBet[],
    [parlayIds, allBetsById],
  );

  return {
    data,
    bets,
    loading,
    error,
    gameId,
    marketCategory,
    evOnly,
    hideThin,
    searchText,
    availableMarkets,
    lastUpdatedAt,
    setGameId,
    setMarketCategory,
    setEvOnly,
    setHideThin,
    setSearchText,
    refetch: fetchLive,
    toggleParlay,
    clearParlay,
    parlayBetIds: parlayIds,
    parlayBets,
    parlayCount: parlayIds.size,
    canShowParlay: parlayIds.size >= 2,
  };
}

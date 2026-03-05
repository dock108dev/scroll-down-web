"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GameDetailResponse } from "@/lib/types";
import { isLive } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { pickSnapshot } from "@/lib/score-display";
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";
import { gameSummaryChannel } from "@/realtime/channels";

export function useGameDetail(id: number) {
  const upsertFromDetail = useGameData((s) => s.upsertFromDetail);
  const setActiveGame = useGameData((s) => s.setActiveGame);
  const isDetailFresh = useGameData((s) => s.isDetailFresh);
  const getDetail = useGameData((s) => s.getDetail);
  const getCore = useGameData((s) => s.getCore);
  const realtimeStatus = useGameData((s) => s.realtimeStatus);
  const needsGameRefresh = useGameData((s) => s.needsGameRefresh);
  const clearGameRefresh = useGameData((s) => s.clearGameRefresh);

  const isRevealed = useReveal((s) => s.isRevealed);
  const acceptUpdate = useReveal((s) => s.acceptUpdate);

  const cachedDetail = getDetail(id);
  const [data, setData] = useState<GameDetailResponse | null>(cachedDetail ?? null);
  const [loading, setLoading] = useState(!cachedDetail);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        if (!opts?.silent && isDetailFresh(id)) {
          const cached = getDetail(id);
          if (cached) {
            setData(cached);
            setLoading(false);
            return cached;
          }
        }
        const result = await api.game(id);
        upsertFromDetail(id, result);
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
    [id, upsertFromDetail, isDetailFresh, getDetail],
  );

  // Initial fetch
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // ── Realtime subscription (channels only — dispatcher handles events) ──

  const channels = useMemo(() => [gameSummaryChannel(id)], [id]);
  useRealtimeSubscription(channels);

  // ── Watch recovery flags set by dispatcher ──────────────────

  useEffect(() => {
    if (!needsGameRefresh.has(id)) return;
    clearGameRefresh(id);
    fetchGame({ silent: true });
  }, [needsGameRefresh, id, clearGameRefresh, fetchGame]);

  // ── Visibility change: freeze snapshot + refetch when offline ──

  useEffect(() => {
    if (!data) return;
    const gameStatus = data.game.status;
    if (!isLive(gameStatus, data.game)) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const c = getCore(id);
        if (c && isRevealed(id)) {
          acceptUpdate(id, pickSnapshot(c));
        }
        setActiveGame(null);

        if (!realtimeStatus.connected) {
          fetchGame({ silent: true });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [data?.game.status, fetchGame, id, getCore, isRevealed, acceptUpdate, setActiveGame, realtimeStatus.connected]);

  // Auto-accept: set active game on mount, sync snapshot on unmount
  useEffect(() => {
    setActiveGame(id);
    return () => {
      setActiveGame(null);
      const core = getCore(id);
      if (core && isRevealed(id) && isLive(core.status, core)) {
        acceptUpdate(id, pickSnapshot(core));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const core: GameCore | undefined = getCore(id);

  return { data, core, loading, error, refetch: fetchGame };
}

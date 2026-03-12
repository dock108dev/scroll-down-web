"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GameDetailResponse } from "@/lib/types";
import { isLive } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";
import { gameSummaryChannel } from "@/realtime/channels";
import { useVisibilityRefresh } from "./useVisibilityRefresh";

export function useGameDetail(id: number) {
  const upsertFromDetail = useGameData((s) => s.upsertFromDetail);
  const setActiveGame = useGameData((s) => s.setActiveGame);
  const isDetailFresh = useGameData((s) => s.isDetailFresh);
  const getDetail = useGameData((s) => s.getDetail);
  const getCore = useGameData((s) => s.getCore);
  const realtimeStatus = useGameData((s) => s.realtimeStatus);
  const needsGameRefresh = useGameData((s) => s.needsGameRefresh);
  const clearGameRefresh = useGameData((s) => s.clearGameRefresh);

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

  // ── Visibility change: refetch after prolonged background or offline ──
  //
  // Browsers throttle background tabs, so realtime events may be missed even
  // while the WebSocket appears connected. useVisibilityRefresh triggers a
  // silent REST refresh when hidden > VISIBILITY_AWAY_MS *or* when the
  // realtime connection is offline. Only fires for live games.

  const gameStatus = data?.game.status;
  const gameIsLive = data ? isLive(gameStatus!, data.game) : false;

  useVisibilityRefresh(
    () => { if (gameIsLive) fetchGame({ silent: true }); },
    realtimeStatus.connected,
  );

  // Track which game page is open (used by visibility handler).
  // No auto-accept: the user must manually click "Update" to advance the snapshot.
  useEffect(() => {
    setActiveGame(id);
    return () => {
      setActiveGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const core: GameCore | undefined = getCore(id);

  return { data, core, loading, error, refetch: fetchGame };
}

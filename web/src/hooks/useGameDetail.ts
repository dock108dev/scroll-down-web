"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GameDetailResponse } from "@/lib/types";
import { isLive } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { pickSnapshot, differs } from "@/lib/score-display";
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

  // ── Visibility change: sync snapshot + refetch when offline ──
  //
  // When the user returns to the tab we freeze a snapshot (so the home-page
  // pinned bar reflects what they last saw) and refetch if the realtime
  // connection dropped.  We do NOT clear activeGameId — the user is still
  // on the game page and should keep seeing live score updates.

  const gameStatus = data?.game.status;
  const gameIsLive = data ? isLive(gameStatus!, data.game) : false;

  useEffect(() => {
    if (!gameIsLive) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Sync snapshot so the pinned bar / home page has a current baseline,
        // but only if we're in active/auto-accept mode.
        const isActive = useGameData.getState().activeGameId === id;
        if (isActive) {
          const c = getCore(id);
          if (c && isRevealed(id)) {
            acceptUpdate(id, pickSnapshot(c));
          }
        }
        // Don't clear activeGameId — keep live updates flowing on this page.

        if (!realtimeStatus.connected) {
          fetchGame({ silent: true });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [gameIsLive, fetchGame, id, getCore, isRevealed, acceptUpdate, realtimeStatus.connected]);

  // Auto-accept: set active game on mount, sync snapshot on unmount
  // Skip setting activeGameId if the game already has a pending update (UPD);
  // the user should see the snapshot score and manually accept via "TAP TO UPDATE".
  useEffect(() => {
    const snap = useReveal.getState().getSnapshot(id);
    const c = getCore(id);
    const hasPendingUpdate =
      c && snap && isRevealed(id) && isLive(c.status, c) && differs(c, snap);

    if (!hasPendingUpdate) {
      setActiveGame(id);
    }

    return () => {
      // Only sync snapshot on unmount if we were in active/auto-accept mode.
      // If the user navigated here with a pending update and never accepted,
      // don't silently advance the snapshot.
      const wasActive = useGameData.getState().activeGameId === id;
      setActiveGame(null);
      if (wasActive) {
        const core = getCore(id);
        if (core && isRevealed(id) && isLive(core.status, core)) {
          acceptUpdate(id, pickSnapshot(core));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const core: GameCore | undefined = getCore(id);

  return { data, core, loading, error, refetch: fetchGame };
}

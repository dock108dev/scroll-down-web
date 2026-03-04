"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GameDetailResponse } from "@/lib/types";
import { isLive, isFinal } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { pickSnapshot } from "@/lib/score-display";
import { POLLING } from "@/lib/config";

export function useGameDetail(id: number) {
  const upsertFromDetail = useGameData((s) => s.upsertFromDetail);
  const setActiveGame = useGameData((s) => s.setActiveGame);
  const isDetailFresh = useGameData((s) => s.isDetailFresh);
  const getDetail = useGameData((s) => s.getDetail);
  const getCore = useGameData((s) => s.getCore);

  const isRevealed = useReveal((s) => s.isRevealed);
  const acceptUpdate = useReveal((s) => s.acceptUpdate);

  const cachedDetail = getDetail(id);
  const [data, setData] = useState<GameDetailResponse | null>(cachedDetail ?? null);
  const [loading, setLoading] = useState(!cachedDetail);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Live polling — pauses when tab is hidden, immediate refetch on wake.
  // On wake: freeze snapshot + clear activeGame so scores don't silently jump.
  // User must accept the update to see new scores.
  useEffect(() => {
    if (!data) return;
    const gameStatus = data.game.status;
    if (!isLive(gameStatus)) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        await fetchGame({ silent: true });
        // Auto-accept during continuous viewing (keeps snapshot in sync)
        const c = getCore(id);
        if (c && isRevealed(id)) {
          acceptUpdate(id, pickSnapshot(c));
        }
      }, POLLING.LIVE_GAME_POLL_MS);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Freeze snapshot at pre-sleep state so hasUpdate detects changes
        const c = getCore(id);
        if (c && isRevealed(id)) {
          acceptUpdate(id, pickSnapshot(c));
        }
        // Disable auto-accept by clearing active game
        // (user must click to accept the update)
        setActiveGame(null);
        fetchGame({ silent: true });
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [data?.game.status, fetchGame, id, getCore, isRevealed, acceptUpdate, setActiveGame]);

  // Auto-accept: set active game on mount, sync snapshot on unmount
  useEffect(() => {
    setActiveGame(id);
    return () => {
      setActiveGame(null);
      // Freeze snapshot to what user last saw
      const core = getCore(id);
      if (core && isRevealed(id) && isLive(core.status, core)) {
        acceptUpdate(id, pickSnapshot(core));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Derive core from store for consumers
  const core: GameCore | undefined = getCore(id);

  return { data, core, loading, error, refetch: fetchGame };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CatchupCard, CatchupCardsResponse } from "@/lib/types";
import { POLLING } from "@/lib/config";

interface UseCatchupCardsReturn {
  cards: CatchupCard[];
  isFinal: boolean;
  lastPlayIndex: number;
  loading: boolean;
  error: string | null;
  /** Manually re-fetch from current `lastPlayIndex` to pick up new live plays. */
  refresh: () => Promise<void>;
}

/**
 * Loads the catch-up deck for a single game and incrementally appends new
 * plays as the live game progresses. The first request returns the scene
 * setter + every key play to date. Subsequent polls (or manual refresh) ask
 * for plays after the last index we've seen and append them.
 */
export function useCatchupCards(gameId: number): UseCatchupCardsReturn {
  const [cards, setCards] = useState<CatchupCard[]>([]);
  const [isFinal, setIsFinal] = useState(false);
  const [lastPlayIndex, setLastPlayIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastIdxRef = useRef(-1);

  const fetchInitial = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data: CatchupCardsResponse = await api.cards(gameId, undefined, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setCards(data.cards);
      setIsFinal(data.isFinal);
      setLastPlayIndex(data.lastPlayIndex);
      lastIdxRef.current = data.lastPlayIndex;
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load game");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [gameId]);

  const refresh = useCallback(async () => {
    if (lastIdxRef.current < 0) {
      await fetchInitial();
      return;
    }
    const controller = new AbortController();
    try {
      const data = await api.cards(
        gameId,
        { since: lastIdxRef.current },
        { signal: controller.signal },
      );
      if (data.cards.length > 0) {
        setCards((prev) => [...prev, ...data.cards]);
      }
      setIsFinal(data.isFinal);
      setLastPlayIndex(data.lastPlayIndex);
      lastIdxRef.current = data.lastPlayIndex;
    } catch {
      /* surfaced on next manual attempt */
    }
  }, [gameId, fetchInitial]);

  useEffect(() => {
    setLoading(true);
    setCards([]);
    setIsFinal(false);
    setLastPlayIndex(-1);
    lastIdxRef.current = -1;
    fetchInitial();
    return () => abortRef.current?.abort();
  }, [fetchInitial]);

  // While live and visible, poll for new key plays.
  useEffect(() => {
    if (isFinal) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    }, POLLING.LIVE_CARDS_POLL_MS);
    return () => clearInterval(id);
  }, [isFinal, refresh]);

  return { cards, isFinal, lastPlayIndex, loading, error, refresh };
}

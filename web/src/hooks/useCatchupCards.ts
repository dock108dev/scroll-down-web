"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptDeck } from "@/lib/adapters/scroll-down-mlb-deck-adapter";
import { getScrollDownMlbDeck } from "@/lib/scroll-down-mlb-api";
import { POLLING } from "@/lib/config";
import type { CatchupCard } from "@/lib/types";
import type { SdmDeckResponse } from "@/types/scroll-down-mlb";

interface UseCatchupCardsReturn {
  cards: CatchupCard[];
  isFinal: boolean;
  lastPlayIndex: number;
  loading: boolean;
  error: string | null;
  /** True when polling has observed a deck whose `deckVersion` is newer
   *  than the one currently rendered. The UI surfaces this via the
   *  "New moments available" banner. */
  hasNewDeck: boolean;
  /** Apply the pending newer deck. The renderer swaps to the new cards
   *  when the user explicitly opts in. Does not auto-fire. */
  applyPendingDeck: () => void;
  /** Manual force re-fetch — discards any pending state, treats the
   *  result as the current deck. Used for explicit "retry" / refresh. */
  refresh: () => Promise<void>;
}

/**
 * Loads the Scroll Down MLB deck for a single game.
 *
 * Live deck behavior:
 *   1. Initial fetch renders the current deck.
 *   2. Polling fetches the deck. If `deckVersion` matches the rendered
 *      one, do nothing.
 *   3. If `deckVersion` is newer, store as `pendingDeck` and raise
 *      `hasNewDeck`. The hook does NOT decide when to swap — the parent
 *      (CatchupExperience) auto-applies on the live tail card and shows
 *      the "New moments" banner mid-deck. This split keeps the hook
 *      stateless about user-position and avoids yanking scroll context.
 *   4. `applyPendingDeck()` swaps visible → pending in one step.
 */
export function useCatchupCards(gameId: number): UseCatchupCardsReturn {
  const [currentDeck, setCurrentDeck] = useState<SdmDeckResponse | null>(null);
  const [pendingDeck, setPendingDeck] = useState<SdmDeckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchDeck = useCallback(
    async (mode: "initial" | "poll" | "refresh"): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await getScrollDownMlbDeck(String(gameId), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!data) {
          // 404 = no deck yet. Treat as empty current deck.
          if (mode !== "poll") {
            setCurrentDeck(null);
            setPendingDeck(null);
            setError(null);
          }
          return;
        }
        if (mode === "poll" && currentDeck) {
          if (data.deckVersion === currentDeck.deckVersion) {
            // Nothing changed — no UI update.
            return;
          }
          // Newer deck observed. Hold it as pending; the user will opt in.
          setPendingDeck(data);
          return;
        }
        // initial / refresh / no current deck: take it as the visible deck.
        setCurrentDeck(data);
        setPendingDeck(null);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        // Polling failures are non-fatal — keep the current deck visible
        // rather than yanking the user to an error state. Initial/refresh
        // failures *do* surface so the explicit retry CTA can react. See
        // docs/audits/error-handling-report.md §I5.
        if (mode === "poll") return;
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        if (!controller.signal.aborted && mode !== "poll") {
          setLoading(false);
        }
      }
    },
    [gameId, currentDeck],
  );

  // Initial load.
  useEffect(() => {
    setLoading(true);
    setCurrentDeck(null);
    setPendingDeck(null);
    setError(null);
    fetchDeck("initial").catch(() => {});
    return () => abortRef.current?.abort();
    // We deliberately depend on gameId only — fetchDeck closes over
    // currentDeck for the deckVersion compare, but we don't want that
    // to retrigger the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Poll while the game is live (deck not final).
  useEffect(() => {
    const isFinal = currentDeck?.isFinal ?? false;
    if (isFinal) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchDeck("poll").catch(() => {});
    }, POLLING.LIVE_CARDS_POLL_MS);
    return () => clearInterval(id);
  }, [currentDeck, fetchDeck]);

  const refresh = useCallback(async () => {
    await fetchDeck("refresh");
  }, [fetchDeck]);

  const applyPendingDeck = useCallback(() => {
    setPendingDeck((pending) => {
      if (pending) setCurrentDeck(pending);
      return null;
    });
  }, []);

  const adapted = currentDeck ? adaptDeck(currentDeck) : null;
  const cards = adapted?.cards ?? [];
  const isFinal = adapted?.isFinal ?? false;
  const lastPlayIndex = adapted?.lastPlayIndex ?? -1;
  const hasNewDeck = pendingDeck !== null;

  return {
    cards,
    isFinal,
    lastPlayIndex,
    loading,
    error,
    hasNewDeck,
    applyPendingDeck,
    refresh,
  };
}

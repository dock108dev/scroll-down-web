"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GolfTournament } from "@/lib/golf-types";
import { POLLING, STORAGE_KEYS } from "@/lib/config";
import { readCache, writeCache } from "@/lib/stale-cache";

export interface GolfTournamentSections {
  thisWeek: GolfTournament[];
  upcoming: GolfTournament[];
  recent: GolfTournament[];
}

export function useGolfTournaments() {
  // Seed from localStorage on cold start
  const localCache = readCache<GolfTournament[]>(STORAGE_KEYS.GOLF_CACHE);

  const [tournaments, setTournaments] = useState<GolfTournament[]>(localCache?.data ?? []);
  const [loading, setLoading] = useState(!localCache);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(!!localCache);
  const [staleAt, setStaleAt] = useState<number | null>(localCache?.savedAt ?? null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTournaments = useCallback(async (opts?: { silent?: boolean }) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Safety timeout — abort after 15s to prevent stuck loading state
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);

    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await api.golfTournaments(undefined, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setTournaments(data.tournaments);
        writeCache(STORAGE_KEYS.GOLF_CACHE, data.tournaments);
        setStale(false);
        setStaleAt(null);
      }
    } catch (err) {
      // Ignore aborts from cleanup/new-fetch, but treat timeouts as errors
      if (controller.signal.aborted && !timedOut) return;
      // If we have data, show it as stale instead of error
      setTournaments((prev) => {
        if (prev.length > 0) {
          setStale(true);
          setStaleAt((prevAt) => prevAt ?? Date.now());
          setError(null);
        } else {
          setError(
            timedOut ? "Request timed out" : (err instanceof Error ? err.message : "Failed to fetch tournaments"),
          );
        }
        return prev;
      });
    } finally {
      clearTimeout(timeout);
      if (!controller.signal.aborted || timedOut) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
    return () => { abortRef.current?.abort(); };
  }, [fetchTournaments]);

  // Poll for updates — skip when in error or stale state to avoid flooding console
  useEffect(() => {
    if (error || stale) return;
    const id = setInterval(
      () => fetchTournaments({ silent: true }),
      POLLING.GOLF_TOURNAMENTS_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [fetchTournaments, error, stale]);

  const sections: GolfTournamentSections = useMemo(() => {
    const now = new Date();
    const thisWeek: GolfTournament[] = [];
    const upcoming: GolfTournament[] = [];
    const recent: GolfTournament[] = [];

    for (const t of tournaments) {
      if (t.status === "in_progress") {
        thisWeek.push(t);
      } else if (t.status === "upcoming") {
        // Show tournaments starting within 7 days as "this week", rest as upcoming
        const start = new Date(t.start_date);
        const daysUntil =
          (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil <= 7) {
          thisWeek.push(t);
        } else {
          upcoming.push(t);
        }
      } else if (t.status === "completed") {
        recent.push(t);
      }
    }

    return { thisWeek, upcoming, recent };
  }, [tournaments]);

  return { sections, tournaments, loading, error, stale, staleAt, refetch: fetchTournaments };
}

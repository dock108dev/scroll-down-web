"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { CACHE, POLLING, API } from "@/lib/config";

// ── Date helpers (US/Eastern) ──────────────────────────────

function easternToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert a gameDate (ISO datetime or YYYY-MM-DD) to an Eastern-time date string */
function toEasternDateStr(gameDate: string): string {
  if (gameDate.length === 10) return gameDate;
  return new Date(gameDate).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

// ── Section date ranges ────────────────────────────────────

export type SectionKey = "Yesterday" | "Today";

export const SECTION_ORDER: SectionKey[] = [
  "Yesterday",
  "Today",
];

interface DateRange {
  startDate: string;
  endDate: string;
}

function getSectionDateRanges(): Record<SectionKey, DateRange> {
  const today = easternToday();
  return {
    Yesterday: {
      startDate: fmt(addDays(today, -1)),
      endDate: fmt(addDays(today, -1)),
    },
    Today: {
      startDate: fmt(today),
      endDate: fmt(today),
    },
  };
}

// ── Fetch a single section ─────────────────────────────────

async function fetchSection(
  range: DateRange,
  league?: string,
): Promise<GameSummary[]> {
  const params = new URLSearchParams();
  params.set("startDate", range.startDate);
  params.set("endDate", range.endDate);
  params.set("limit", String(API.GAMES_LIMIT));
  if (league) params.set("league", league);
  const data = await api.games(params);
  return data.games;
}

// ── Client-side search filter ──────────────────────────────

function matchesSearch(core: GameCore, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    core.homeTeam.toLowerCase().includes(q) ||
    core.awayTeam.toLowerCase().includes(q) ||
    (core.homeTeamAbbr?.toLowerCase().includes(q) ?? false) ||
    (core.awayTeamAbbr?.toLowerCase().includes(q) ?? false)
  );
}

// ── Hook return type ───────────────────────────────────────

export interface SectionData {
  key: SectionKey;
  games: GameCore[];
}

interface UseGamesListReturn {
  sections: SectionData[];
  allGames: GameCore[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ── Track list fetch freshness per league ───────────────────

const listFetchTimestamps = new Map<string, number>();

// ── Hook ───────────────────────────────────────────────────

export function useGamesList(league?: string, search?: string): UseGamesListReturn {
  const cacheKey = league ?? "";
  const upsertFromList = useGameData((s) => s.upsertFromList);
  const games = useGameData((s) => s.games);
  const listFetches = useGameData((s) => s.listFetches);

  // Track section keys per league (Yesterday/Today game IDs).
  // Lazy initializer reconstructs from the Zustand store on remount so
  // back-navigation doesn't show an empty list while the cache-check
  // skips the network fetch.
  const [sectionIds, setSectionIds] = useState<Record<SectionKey, number[]>>(
    () => {
      const meta = listFetches.get(cacheKey);
      if (!meta) return { Yesterday: [], Today: [] };
      const ranges = getSectionDateRanges();
      const result: Record<SectionKey, number[]> = { Yesterday: [], Today: [] };
      for (const id of meta.gameIds) {
        const entry = games.get(id);
        if (!entry) continue;
        const d = toEasternDateStr(entry.core.gameDate);
        for (const key of SECTION_ORDER) {
          if (d >= ranges[key].startDate && d <= ranges[key].endDate) {
            result[key].push(id);
            break;
          }
        }
      }
      return result;
    },
  );

  const hasCached = listFetches.has(cacheKey);
  const [loading, setLoading] = useState(!hasCached);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLeagueRef = useRef(league);

  const fetchAll = useCallback(async (showLoading?: boolean) => {
    // Check freshness — skip if recently fetched
    const lastFetch = listFetchTimestamps.get(cacheKey);
    if (lastFetch && !showLoading) {
      const age = Date.now() - lastFetch;
      if (age < CACHE.GAMES_FRESH_MS) return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    const ranges = getSectionDateRanges();

    try {
      const [yesterday, today] = await Promise.all([
        fetchSection(ranges.Yesterday, league),
        fetchSection(ranges.Today, league),
      ]);

      // Deduplicate and upsert into canonical game data store
      const allFetched = new Map<number, GameSummary>();
      for (const g of [...yesterday, ...today]) allFetched.set(g.id, g);
      upsertFromList(cacheKey, Array.from(allFetched.values()));
      listFetchTimestamps.set(cacheKey, Date.now());

      // Bucket by Eastern-time date (backend may use UTC boundaries)
      const buckets: Record<SectionKey, number[]> = { Yesterday: [], Today: [] };
      for (const g of allFetched.values()) {
        const d = toEasternDateStr(g.gameDate);
        for (const key of SECTION_ORDER) {
          if (d >= ranges[key].startDate && d <= ranges[key].endDate) {
            buckets[key].push(g.id);
            break;
          }
        }
      }
      setSectionIds(buckets);

      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch games",
      );
      setLoading(false);
    }
  }, [league, cacheKey, upsertFromList]);

  // Initial fetch + refetch on league change
  useEffect(() => {
    const isLeagueChange = prevLeagueRef.current !== league;
    prevLeagueRef.current = league;
    fetchAll(isLeagueChange || loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll]);

  // Auto-refresh every 60s, pause when tab is hidden
  useEffect(() => {
    const start = () => {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => fetchAll(), POLLING.GAMES_REFRESH_MS);
      }
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchAll();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchAll]);

  // Derive sections from store using tracked section IDs
  const sections: SectionData[] = useMemo(() => {
    return SECTION_ORDER.map((key) => {
      const ids = sectionIds[key] ?? [];
      const cores: GameCore[] = [];
      for (const id of ids) {
        const entry = games.get(id);
        if (entry) {
          const core = entry.core;
          if (matchesSearch(core, search ?? "")) {
            cores.push(core);
          }
        }
      }
      return { key, games: cores };
    });
  }, [sectionIds, games, search]);

  const allGames = useMemo(
    () => sections.flatMap((s) => s.games),
    [sections],
  );

  return { sections, allGames, loading, error, refetch: fetchAll };
}

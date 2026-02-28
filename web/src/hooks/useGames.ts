"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
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

function matchesSearch(game: GameSummary, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    game.homeTeam.toLowerCase().includes(q) ||
    game.awayTeam.toLowerCase().includes(q) ||
    (game.homeTeamAbbr?.toLowerCase().includes(q) ?? false) ||
    (game.awayTeamAbbr?.toLowerCase().includes(q) ?? false)
  );
}

// ── Hook return type ───────────────────────────────────────

export interface SectionData {
  key: SectionKey;
  games: GameSummary[];
}

interface UseGamesReturn {
  sections: SectionData[];
  allGames: GameSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ── In-memory cache ─────────────────────────────────────────

interface GamesCacheEntry {
  sectionMap: Record<SectionKey, GameSummary[]>;
  fetchedAt: number;
}

const gamesCache = new Map<string, GamesCacheEntry>();

function getGamesCached(league: string): GamesCacheEntry | null {
  const entry = gamesCache.get(league);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE.GAMES_TTL_MS) {
    gamesCache.delete(league);
    return null;
  }
  return entry;
}

function setGamesCache(league: string, sectionMap: Record<SectionKey, GameSummary[]>) {
  if (gamesCache.size >= CACHE.GAMES_MAX_ENTRIES && !gamesCache.has(league)) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of gamesCache) {
      if (entry.fetchedAt < oldestTime) {
        oldestTime = entry.fetchedAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) gamesCache.delete(oldestKey);
  }
  gamesCache.set(league, { sectionMap, fetchedAt: Date.now() });
}

// ── Hook ───────────────────────────────────────────────────

export function useGames(league?: string, search?: string): UseGamesReturn {
  const cacheKey = league ?? "";
  const cached = getGamesCached(cacheKey);

  const [sectionMap, setSectionMap] = useState<
    Record<SectionKey, GameSummary[]>
  >(
    cached?.sectionMap ?? {
      Yesterday: [],
      Today: [],
    },
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLeagueRef = useRef(league);

  const fetchAll = useCallback(async (showLoading?: boolean) => {
    // Check cache freshness — skip network if fresh enough
    const entry = getGamesCached(cacheKey);
    if (entry && !showLoading) {
      const age = Date.now() - entry.fetchedAt;
      if (age < CACHE.GAMES_FRESH_MS) {
        // Fresh cache — skip network entirely
        return;
      }
      // Stale cache — use cached data, silent background refresh (no loading state)
    }

    if (showLoading) setLoading(true);
    setError(null);
    const ranges = getSectionDateRanges();

    try {
      const [yesterday, today] = await Promise.all([
        fetchSection(ranges.Yesterday, league),
        fetchSection(ranges.Today, league),
      ]);

      const fullMap = {
        Yesterday: yesterday,
        Today: today,
      };
      setSectionMap(fullMap);
      setLoading(false);
      setGamesCache(cacheKey, fullMap);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch games",
      );
      setLoading(false);
    }
  }, [league, cacheKey]);

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
        fetchAll(); // refresh immediately when tab regains focus
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

  // Apply client-side search filter & build sections array
  const sections: SectionData[] = SECTION_ORDER.map((key) => ({
    key,
    games: (sectionMap[key] ?? []).filter((g) => matchesSearch(g, search ?? "")),
  }));

  const allGames = sections.flatMap((s) => s.games);

  return { sections, allGames, loading, error, refetch: fetchAll };
}

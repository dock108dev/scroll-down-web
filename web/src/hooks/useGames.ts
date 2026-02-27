"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";

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

export type SectionKey = "Earlier" | "Yesterday" | "Today" | "Tomorrow";

export const SECTION_ORDER: SectionKey[] = [
  "Earlier",
  "Yesterday",
  "Today",
  "Tomorrow",
];

interface DateRange {
  startDate: string;
  endDate: string;
}

function getSectionDateRanges(): Record<SectionKey, DateRange> {
  const today = easternToday();
  return {
    Earlier: {
      startDate: fmt(addDays(today, -3)),
      endDate: fmt(addDays(today, -2)),
    },
    Yesterday: {
      startDate: fmt(addDays(today, -1)),
      endDate: fmt(addDays(today, -1)),
    },
    Today: {
      startDate: fmt(today),
      endDate: fmt(today),
    },
    Tomorrow: {
      startDate: fmt(addDays(today, 1)),
      endDate: fmt(addDays(today, 1)),
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
  params.set("limit", "200");
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

// ── Auto-refresh interval ──────────────────────────────────
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ── Hook ───────────────────────────────────────────────────

export function useGames(league?: string, search?: string): UseGamesReturn {
  const [sectionMap, setSectionMap] = useState<
    Record<SectionKey, GameSummary[]>
  >({
    Earlier: [],
    Yesterday: [],
    Today: [],
    Tomorrow: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLeagueRef = useRef(league);

  const fetchAll = useCallback(async (showLoading?: boolean) => {
    if (showLoading) setLoading(true);
    setError(null);
    const ranges = getSectionDateRanges();

    try {
      // Phase 1: fetch Yesterday + Today in parallel (highest priority)
      const [yesterday, today] = await Promise.all([
        fetchSection(ranges.Yesterday, league),
        fetchSection(ranges.Today, league),
      ]);

      // Update immediately so the user sees data fast
      setSectionMap((prev) => ({
        ...prev,
        Yesterday: yesterday,
        Today: today,
      }));
      setLoading(false);

      // Phase 2: fetch Earlier + Tomorrow in parallel
      const [earlier, tomorrow] = await Promise.all([
        fetchSection(ranges.Earlier, league),
        fetchSection(ranges.Tomorrow, league),
      ]);

      setSectionMap({
        Earlier: earlier,
        Yesterday: yesterday,
        Today: today,
        Tomorrow: tomorrow,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch games",
      );
      setLoading(false);
    }
  }, [league]);

  // Initial fetch + refetch on league change
  useEffect(() => {
    const isLeagueChange = prevLeagueRef.current !== league;
    prevLeagueRef.current = league;
    fetchAll(isLeagueChange || loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchAll();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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

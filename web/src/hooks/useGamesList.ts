"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { CACHE, API } from "@/lib/config";
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";
import { gameListChannel } from "@/realtime/channels";
import { easternToday, addDays, fmtDate, toEasternDateStr } from "@/lib/date-utils";
import { useVisibilityRefresh } from "./useVisibilityRefresh";

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
      startDate: fmtDate(addDays(today, -1)),
      endDate: fmtDate(addDays(today, -1)),
    },
    Today: {
      startDate: fmtDate(today),
      endDate: fmtDate(today),
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

// ── Track list fetch freshness per listKey ──────────────────

const listFetchTimestamps = new Map<string, number>();

// ── Hook ───────────────────────────────────────────────────

export function useGamesList(league?: string, search?: string): UseGamesListReturn {
  const leagueKey = league || "all";
  const upsertFromList = useGameData((s) => s.upsertFromList);
  const games = useGameData((s) => s.games);
  const listFetches = useGameData((s) => s.listFetches);
  const realtimeStatus = useGameData((s) => s.realtimeStatus);
  const needsListRefresh = useGameData((s) => s.needsListRefresh);
  const clearListRefresh = useGameData((s) => s.clearListRefresh);

  // Fix 4: channels + listKeys aligned by league+date
  const ranges = useMemo(() => getSectionDateRanges(), []);

  const channels = useMemo(() => {
    return SECTION_ORDER.map((key) =>
      gameListChannel(leagueKey, ranges[key].startDate),
    );
  }, [leagueKey, ranges]);

  // listKey per section (matches channel naming)
  const listKeys = useMemo(
    () => SECTION_ORDER.map((key) => gameListChannel(leagueKey, ranges[key].startDate)),
    [leagueKey, ranges],
  );

  // Track section keys per league (Yesterday/Today game IDs).
  const [sectionIds, setSectionIds] = useState<Record<SectionKey, number[]>>(
    () => {
      const result: Record<SectionKey, number[]> = { Yesterday: [], Today: [] };
      for (const key of SECTION_ORDER) {
        const lk = gameListChannel(leagueKey, ranges[key].startDate);
        const meta = listFetches.get(lk);
        if (!meta) continue;
        for (const id of meta.gameIds) {
          const entry = games.get(id);
          if (!entry) continue;
          const d = toEasternDateStr(entry.core.gameDate);
          if (d >= ranges[key].startDate && d <= ranges[key].endDate) {
            result[key].push(id);
          }
        }
      }
      return result;
    },
  );

  const hasCached = listKeys.some((lk) => listFetches.has(lk));
  const [loading, setLoading] = useState(!hasCached);
  const [error, setError] = useState<string | null>(null);
  const prevLeagueRef = useRef(league);

  const fetchAll = useCallback(async (showLoading?: boolean, force?: boolean) => {
    // Check freshness per listKey — skip if all recently fetched (unless forced)
    if (!force) {
      const allFresh = listKeys.every((lk) => {
        const last = listFetchTimestamps.get(lk);
        return last && !showLoading && Date.now() - last < CACHE.GAMES_FRESH_MS;
      });
      if (allFresh) return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      const [yesterday, today] = await Promise.all([
        fetchSection(ranges.Yesterday, league),
        fetchSection(ranges.Today, league),
      ]);

      // Upsert per section with aligned listKeys
      const sections: [SectionKey, GameSummary[]][] = [
        ["Yesterday", yesterday],
        ["Today", today],
      ];
      const buckets: Record<SectionKey, number[]> = { Yesterday: [], Today: [] };

      for (const [key, summaries] of sections) {
        const lk = gameListChannel(leagueKey, ranges[key].startDate);
        const deduped = new Map<number, GameSummary>();
        for (const g of summaries) deduped.set(g.id, g);
        upsertFromList(lk, Array.from(deduped.values()));
        listFetchTimestamps.set(lk, Date.now());

        for (const g of deduped.values()) {
          const d = toEasternDateStr(g.gameDate);
          if (d >= ranges[key].startDate && d <= ranges[key].endDate) {
            buckets[key].push(g.id);
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
  }, [league, leagueKey, ranges, listKeys, upsertFromList]);

  // Initial fetch + refetch on league change
  useEffect(() => {
    const isLeagueChange = prevLeagueRef.current !== league;
    prevLeagueRef.current = league;
    fetchAll(isLeagueChange || loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll]);

  // ── Realtime subscription (channels only — dispatcher handles events) ──

  useRealtimeSubscription(channels);

  // ── Watch recovery flags set by dispatcher ──────────────────

  useEffect(() => {
    const pending = listKeys.filter((lk) => needsListRefresh.has(lk));
    if (pending.length === 0) return;
    // Clear flags first to prevent re-trigger
    for (const lk of pending) clearListRefresh(lk);
    fetchAll(false, true);
  }, [needsListRefresh, listKeys, clearListRefresh, fetchAll]);

  // ── Visibility change: refresh after prolonged background or offline ──

  useVisibilityRefresh(
    () => fetchAll(false, true),
    realtimeStatus.connected,
  );

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

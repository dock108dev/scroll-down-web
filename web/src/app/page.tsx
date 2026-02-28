"use client";

import { useMemo, useState, useCallback } from "react";
import { useGames, SECTION_ORDER } from "@/hooks/useGames";

import { SearchBar } from "@/components/home/SearchBar";
import { GameSection } from "@/components/home/GameSection";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { isLive, isFinal } from "@/lib/types";
import type { GameSummary } from "@/lib/types";
import { useReadState } from "@/stores/read-state";
import { useReadingPosition } from "@/stores/reading-position";
import { useSettings } from "@/stores/settings";
import { cn } from "@/lib/utils";

// ── Sorting helpers ────────────────────────────────────────

/**
 * Sort all games by tip time (gameDate ASC).
 * Earlier tip-off → closer to finishing → appears first.
 */
function sortByTipTime(games: GameSummary[]): GameSummary[] {
  return [...games].sort(
    (a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime(),
  );
}

// ── Derive available leagues from all games ────────────────

function deriveLeagues(games: GameSummary[]): string[] {
  const set = new Set<string>();
  for (const g of games) {
    if (g.leagueCode) set.add(g.leagueCode.toLowerCase());
  }
  return Array.from(set).sort();
}

// ── Page component ─────────────────────────────────────────

export default function HomePage() {
  const [league, setLeague] = useState("");
  const [search, setSearch] = useState("");
  const { sections, allGames, loading, error, refetch } = useGames(
    league || undefined,
    search || undefined,
  );

  const readState = useReadState();
  const getPosition = useReadingPosition((s) => s.getPosition);
  const savePosition = useReadingPosition((s) => s.savePosition);
  const clearPosition = useReadingPosition((s) => s.clearPosition);
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  // Derive league pills from all fetched games
  const availableLeagues = useMemo(() => deriveLeagues(allGames), [allGames]);

  // Sorted sections
  const sortedSections = useMemo(
    () =>
      SECTION_ORDER.map((key) => {
        const sec = sections.find((s) => s.key === key);
        return {
          key,
          games: sec ? sortByTipTime(sec.games) : [],
        };
      }),
    [sections],
  );

  // Which sections are currently expanded (visible)?
  const visibleGames = useMemo(() => {
    return sortedSections.flatMap((s) =>
      homeExpandedSections.includes(s.key) ? s.games : [],
    );
  }, [sortedSections, homeExpandedSections]);

  // Count unread final games in visible sections only
  const unreadFinalCount = useMemo(
    () =>
      visibleGames.filter(
        (g) => isFinal(g.status) && !readState.isRead(g.id),
      ).length,
    [visibleGames, readState],
  );

  // Live games needing attention: unread live games + revealed live games with new data
  const liveNeedsAttention = useMemo(() => {
    if (scoreRevealMode === "always") return [];
    return visibleGames.filter((g) => {
      if (!isLive(g.status)) return false;
      if (g.homeScore == null || g.awayScore == null) return false;
      const read = readState.isRead(g.id);
      if (!read) return true; // unread live game — needs reveal
      // Already revealed: check if data changed since snapshot
      const pos = getPosition(g.id);
      if (!pos || pos.homeScore == null || pos.awayScore == null) return false;
      return (
        g.homeScore !== pos.homeScore ||
        g.awayScore !== pos.awayScore ||
        (g.playCount != null && pos.playCount != null && g.playCount > pos.playCount)
      );
    });
  }, [visibleGames, readState, getPosition, scoreRevealMode]);

  const catchUpCount = unreadFinalCount + liveNeedsAttention.length;

  // Count read games in visible sections only
  const readCount = useMemo(
    () => visibleGames.filter((g) => readState.isRead(g.id)).length,
    [visibleGames, readState],
  );

  // Final game IDs in visible sections only
  const visibleFinalGameIds = useMemo(
    () => visibleGames.filter((g) => isFinal(g.status)).map((g) => g.id),
    [visibleGames],
  );

  const visibleGameIds = useMemo(() => visibleGames.map((g) => g.id), [visibleGames]);

  const handleCatchUp = useCallback(() => {
    // Mark unread finals as read
    readState.markAllRead(visibleFinalGameIds);
    // Reveal / re-reveal live games with fresh snapshots
    for (const g of liveNeedsAttention) {
      readState.markRead(g.id, g.status);
      savePosition(g.id, {
        playIndex: -1,
        homeScore: g.homeScore ?? undefined,
        awayScore: g.awayScore ?? undefined,
        period: g.currentPeriod,
        gameClock: g.gameClock,
        periodLabel: g.currentPeriodLabel ?? undefined,
        timeLabel: g.currentPeriodLabel
          ? `${g.currentPeriodLabel}${g.gameClock ? ` ${g.gameClock}` : ""}`
          : undefined,
        playCount: g.playCount,
        savedAt: new Date().toISOString(),
      });
    }
  }, [visibleFinalGameIds, liveNeedsAttention, readState, savePosition]);

  const handleReset = useCallback(() => {
    readState.markAllUnread(visibleGameIds);
    visibleGameIds.forEach((id) => clearPosition(id));
  }, [visibleGameIds, readState, clearPosition]);

  const hasAnyGames = sortedSections.some((s) => s.games.length > 0);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Sticky toolbar */}
      <div className="sticky top-14 z-30 bg-neutral-950 px-4 py-3 space-y-3 border-b border-neutral-800">
        <SearchBar value={search} onChange={setSearch} />

        {/* League filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setLeague("")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              league === ""
                ? "bg-neutral-50 text-neutral-950"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
            )}
          >
            All
          </button>
          {availableLeagues.map((code) => (
            <button
              key={code}
              onClick={() => setLeague(code)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition uppercase",
                league === code
                  ? "bg-neutral-50 text-neutral-950"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
              )}
            >
              {code}
            </button>
          ))}
        </div>

        {/* Batch actions + refresh */}
        {hasAnyGames && (
          <div className="flex items-center gap-3">
            {catchUpCount > 0 && (
              <button
                onClick={handleCatchUp}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Mark All Read
                <span className="ml-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                  {catchUpCount}
                </span>
              </button>
            )}
            {readCount > 0 && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-50 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                Mark as Unread
                <span className="ml-0.5 bg-neutral-700 rounded-full px-1.5 py-0.5 text-[10px]">
                  {readCount}
                </span>
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-50 hover:bg-neutral-800 transition"
              title="Refresh"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 py-4 space-y-3">
          <LoadingSkeleton count={8} className="h-24" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-8 text-center text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasAnyGames && (
        <div className="px-4 py-8 text-center text-neutral-500 text-sm">
          No games found
        </div>
      )}

      {/* Sections */}
      {sortedSections.map((section) => (
        <GameSection
          key={section.key}
          title={section.key}
          games={section.games}
        />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useGamesList, SECTION_ORDER } from "@/hooks/useGamesList";
import type { GameCore } from "@/stores/game-data";

import { SearchBar } from "@/components/home/SearchBar";
import { TimelineSection } from "@/components/home/TimelineSection";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { isLive, isFinal } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useReadingPosition } from "@/stores/reading-position";
import { useSettings } from "@/stores/settings";
import { usePinnedGames } from "@/stores/pinned-games";
import { useHomeScroll } from "@/stores/home-scroll";
import { pickSnapshot } from "@/lib/score-display";
import { cn } from "@/lib/utils";

// ── Sorting helpers ────────────────────────────────────────

/** Status priority: live first, then upcoming, then final */
function statusPriority(game: GameCore): number {
  if (isLive(game.status, game)) return 0;
  if (isFinal(game.status, game)) return 2;
  return 1; // pregame / scheduled
}

function sortByStatusThenTime(games: GameCore[], finalsAlpha = false): GameCore[] {
  return [...games].sort((a, b) => {
    const sp = statusPriority(a) - statusPriority(b);
    if (sp !== 0) return sp;
    // For prior days, sort final games alphabetically by away team
    if (finalsAlpha && isFinal(a.status, a) && isFinal(b.status, b)) {
      return a.awayTeam.localeCompare(b.awayTeam);
    }
    return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
  });
}

// ── Derive available leagues from all games ────────────────

function deriveLeagues(games: GameCore[]): string[] {
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
  const { sections, allGames, loading, error, refetch } = useGamesList(
    league || undefined,
    search || undefined,
  );

  const reveal = useReveal();
  const clearAllPositions = useReadingPosition((s) => s.clearAll);
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  const pinnedIds = usePinnedGames((s) => s.pinnedIds);
  const pruneStale = usePinnedGames((s) => s.pruneStale);

  // Home scroll restoration
  const savedScrollY = useHomeScroll((s) => s.scrollY);
  const setScrollY = useHomeScroll((s) => s.setScrollY);

  // Save scroll position on throttled scroll
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setScrollY]);

  // Restore scroll position on mount
  useEffect(() => {
    if (savedScrollY > 0 && !loading) {
      window.scrollTo(0, savedScrollY);
    }
    // Only run once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Auto-prune pins for games no longer in the fetched range
  useEffect(() => {
    if (allGames.length > 0) {
      pruneStale(allGames.map((g) => g.id));
    }
  }, [allGames, pruneStale]);

  // Derive league pills from all fetched games
  const availableLeagues = useMemo(() => deriveLeagues(allGames), [allGames]);

  // Sorted sections
  const sortedSections = useMemo(
    () =>
      SECTION_ORDER.map((key) => {
        const sec = sections.find((s) => s.key === key);
        // Yesterday and older: sort final games alphabetically by away team
        const finalsAlpha = key !== "Today";
        return {
          key,
          games: sec ? sortByStatusThenTime(sec.games, finalsAlpha) : [],
        };
      }),
    [sections],
  );

  // Games in currently expanded sections only (for batch actions)
  const allVisibleGames = useMemo(() => {
    return sortedSections.flatMap((s) =>
      homeExpandedSections.includes(s.key) ? s.games : [],
    );
  }, [sortedSections, homeExpandedSections]);

  // Count unread final games in visible sections only
  const unreadFinalCount = useMemo(
    () =>
      allVisibleGames.filter(
        (g) => isFinal(g.status, g) && !reveal.isRevealed(g.id),
      ).length,
    [allVisibleGames, reveal],
  );

  // Live games needing attention: unread live games + revealed live games with new data
  const liveNeedsAttention = useMemo(() => {
    if (scoreRevealMode === "always") return [];
    return allVisibleGames.filter((g) => {
      if (!isLive(g.status, g)) return false;
      if (g.homeScore == null || g.awayScore == null) return false;
      const revealed = reveal.isRevealed(g.id);
      if (!revealed) return true;
      // Already revealed: check if data changed since snapshot
      const snap = reveal.getSnapshot(g.id);
      if (!snap) return false;
      return (
        g.homeScore !== snap.homeScore ||
        g.awayScore !== snap.awayScore
      );
    });
  }, [allVisibleGames, reveal, scoreRevealMode]);

  const catchUpCount = unreadFinalCount + liveNeedsAttention.length;

  // Count revealed games in visible sections only
  const readCount = useMemo(
    () => allVisibleGames.filter((g) => reveal.isRevealed(g.id)).length,
    [allVisibleGames, reveal],
  );

  // Final game IDs in visible sections only
  const visibleFinalGameIds = useMemo(
    () => allVisibleGames.filter((g) => isFinal(g.status, g)).map((g) => g.id),
    [allVisibleGames],
  );

  const visibleGameIds = useMemo(() => allVisibleGames.map((g) => g.id), [allVisibleGames]);

  const handleCatchUp = useCallback(() => {
    // Build batch entries: all unread finals + live games needing attention
    const entries: { gameId: number; snapshot: ReturnType<typeof pickSnapshot> }[] = [];

    for (const id of visibleFinalGameIds) {
      if (!reveal.isRevealed(id)) {
        const game = allVisibleGames.find((g) => g.id === id);
        if (game) entries.push({ gameId: id, snapshot: pickSnapshot(game) });
      }
    }
    for (const g of liveNeedsAttention) {
      entries.push({ gameId: g.id, snapshot: pickSnapshot(g) });
    }

    reveal.revealBatch(entries);
  }, [visibleFinalGameIds, liveNeedsAttention, reveal, allVisibleGames]);

  const handleReset = useCallback(() => {
    reveal.hideBatch(visibleGameIds);
    clearAllPositions();
  }, [visibleGameIds, reveal, clearAllPositions]);

  const hasAnyGames = sortedSections.some((s) => s.games.length > 0);

  // Track toolbar height for section header sticky offset
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setToolbarHeight(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stickyTop = `calc(var(--header-h) + ${toolbarHeight}px)`;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky toolbar */}
      <div ref={toolbarRef} className="sticky z-30 bg-neutral-950 px-4 py-3 space-y-3 border-b border-neutral-800" style={{ top: "var(--header-h)" }}>
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
            {scoreRevealMode !== "always" && catchUpCount > 0 && (
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
            {scoreRevealMode !== "always" && readCount > 0 && (
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
          <LoadingSkeleton count={10} variant="timelineRow" />
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
        <TimelineSection
          key={section.key}
          title={section.key}
          games={section.games}
          stickyTop={stickyTop}
          pinnedIds={pinnedIds}
        />
      ))}
    </div>
  );
}

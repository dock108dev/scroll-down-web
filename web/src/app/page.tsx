"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useGamesList, SECTION_ORDER } from "@/hooks/useGamesList";
import type { GameCore } from "@/stores/game-data";

import dynamic from "next/dynamic";
import { SearchBar } from "@/components/home/SearchBar";
import { TimelineSection } from "@/components/home/TimelineSection";
import { RevealHero } from "@/components/home/RevealHero";
import { FollowingLiveBanner } from "@/components/home/FollowingLiveBanner";

// Client-only: reads localStorage on first render, no SSR needed.
const RevealOnboarding = dynamic(
  () => import("@/components/home/RevealOnboarding").then((m) => ({ default: m.RevealOnboarding })),
  { ssr: false },
);
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { isLive, isFinal } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useReadingPosition } from "@/stores/reading-position";
import { useSettings } from "@/stores/settings";
import { usePinnedGames } from "@/stores/pinned-games";
import { useHomeScroll } from "@/stores/home-scroll";
import { pickSnapshot } from "@/lib/score-display";
import { isGameHiddenByBlacklist } from "@/lib/score-hide";
import { Spinner } from "@/components/shared/Spinner";
import { StaleBanner } from "@/components/shared/StaleBanner";
import { cn } from "@/lib/utils";
import { initScrollTracking } from "@/lib/analytics";

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

/** Static fallback so league pills always appear, even when the API is down */
const STATIC_LEAGUES = ["mlb", "nba", "ncaab", "nhl"];

function deriveLeagues(games: GameCore[]): string[] {
  const set = new Set<string>();
  for (const g of games) {
    if (g.leagueCode) set.add(g.leagueCode.toLowerCase());
  }
  const derived = Array.from(set).sort();
  return derived.length > 0 ? derived : STATIC_LEAGUES;
}

// ── Page component ─────────────────────────────────────────

export default function HomePage() {
  const [league, setLeague] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { sections, allGames, loading, error, stale, staleAt, refetch } = useGamesList(
    league || undefined,
    search || undefined,
  );

  const reveal = useReveal();
  const clearAllPositions = useReadingPosition((s) => s.clearAll);
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const followingLive = useSettings((s) => s.followingLive);
  const scoreHideLeagues = useSettings((s) => s.scoreHideLeagues);
  const scoreHideTeams = useSettings((s) => s.scoreHideTeams);

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

  // Scroll depth analytics
  useEffect(() => initScrollTracking(), []);

  const { retryCount, manualRetry } = useAutoRetry({ error, loading, refetch });

  // Auto-prune pins for games no longer in the fetched range
  useEffect(() => {
    if (allGames.length > 0) {
      pruneStale(allGames.map((g) => g.id));
    }
  }, [allGames, pruneStale]);

  // Derive league pills from all fetched games — persist across filter changes
  const leaguesRef = useRef<string[]>([]);
  const availableLeagues = useMemo(() => {
    // Only update the full list when unfiltered (no league selected)
    if (!league) {
      leaguesRef.current = deriveLeagues(allGames);
    }
    return leaguesRef.current;
  }, [allGames, league]);

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

  // Games subject to the hide/reveal workflow under the current mode.
  // "always" → nothing is hidden, so Reveal/Unread actions don't apply.
  // "onMarkRead" → every game is hidden by default.
  // "blacklist" → only blacklisted games are hidden; others are like "always".
  // followingLive temporarily acts like "always" for every mode.
  const hideableGames = useMemo(() => {
    if (followingLive || scoreRevealMode === "always") return [];
    if (scoreRevealMode === "blacklist") {
      return allVisibleGames.filter((g) =>
        isGameHiddenByBlacklist(g, scoreHideLeagues, scoreHideTeams),
      );
    }
    return allVisibleGames;
  }, [allVisibleGames, scoreRevealMode, followingLive, scoreHideLeagues, scoreHideTeams]);

  // Count unread final games among hideable games
  const unreadFinalCount = useMemo(
    () =>
      hideableGames.filter(
        (g) => isFinal(g.status, g) && !reveal.isRevealed(g.id),
      ).length,
    [hideableGames, reveal],
  );

  // Live games needing attention: unread live games + revealed live games with new data
  const liveNeedsAttention = useMemo(() => {
    return hideableGames.filter((g) => {
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
  }, [hideableGames, reveal]);

  const catchUpCount = unreadFinalCount + liveNeedsAttention.length;

  // Count revealed games among hideable games (so "Mark all unread" only
  // counts games that were actually hidden in the first place).
  const readCount = useMemo(
    () => hideableGames.filter((g) => reveal.isRevealed(g.id)).length,
    [hideableGames, reveal],
  );

  const hideableFinalIds = useMemo(
    () => hideableGames.filter((g) => isFinal(g.status, g)).map((g) => g.id),
    [hideableGames],
  );

  const hideableGameIds = useMemo(() => hideableGames.map((g) => g.id), [hideableGames]);

  const handleCatchUp = useCallback(() => {
    // Build batch entries: all unread finals + live games needing attention
    const entries: { gameId: number; snapshot: ReturnType<typeof pickSnapshot> }[] = [];

    for (const id of hideableFinalIds) {
      if (!reveal.isRevealed(id)) {
        const game = hideableGames.find((g) => g.id === id);
        if (game) entries.push({ gameId: id, snapshot: pickSnapshot(game) });
      }
    }
    for (const g of liveNeedsAttention) {
      entries.push({ gameId: g.id, snapshot: pickSnapshot(g) });
    }

    reveal.revealBatch(entries);
  }, [hideableFinalIds, liveNeedsAttention, reveal, hideableGames]);

  const handleReset = useCallback(() => {
    reveal.hideBatch(hideableGameIds);
    clearAllPositions();
  }, [hideableGameIds, reveal, clearAllPositions]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (!value) setSearchOpen(false);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) setSearch("");
      return !prev;
    });
  }, []);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [overflowOpen]);

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
    <div data-testid="page-home" className="mx-auto max-w-2xl">
      {/* Sticky toolbar — row 1: league pills + icons; row 2: search (on demand) */}
      <div ref={toolbarRef} className="sticky z-30 bg-neutral-950 border-b border-neutral-800" style={{ top: "var(--header-h)" }}>
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Scrollable league pills */}
          <div data-testid="league-filter" className="flex gap-1.5 overflow-x-auto scrollbar-none min-w-0 flex-1">
            <button
              onClick={() => setLeague("")}
              className={cn(
                "shrink-0 rounded-full px-3 py-2 min-h-[44px] text-xs font-medium transition",
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
                  "shrink-0 rounded-full px-3 py-2 min-h-[44px] text-xs font-medium transition uppercase",
                  league === code
                    ? "bg-neutral-50 text-neutral-950"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
                )}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Right-justified: search toggle + read (primary) + unread (icon only) + refresh */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Search toggle */}
            <button
              data-testid="search-toggle"
              onClick={handleSearchToggle}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-50 hover:bg-neutral-800 transition"
              aria-label={searchOpen ? "Close search" : "Search teams"}
              title={searchOpen ? "Close search" : "Search teams"}
            >
              {searchOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </button>

            {/* Reveal — primary CTA (matches per-row Reveal button) */}
            {hasAnyGames && scoreRevealMode !== "always" && !followingLive && catchUpCount > 0 && (
              <button
                data-testid="catch-up-button"
                onClick={handleCatchUp}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500 transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Reveal
                <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[9px] leading-none">
                  {catchUpCount}
                </span>
              </button>
            )}

            {/* Overflow — houses the rare "Mark all unread" reset */}
            {hasAnyGames && scoreRevealMode !== "always" && !followingLive && readCount > 0 && (
              <div ref={overflowRef} className="relative">
                <button
                  data-testid="top-overflow-toggle"
                  onClick={() => setOverflowOpen((v) => !v)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-50 hover:bg-neutral-800 transition"
                  title="More actions"
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={overflowOpen}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
                {overflowOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-30 min-w-[180px] rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg py-1"
                  >
                    <button
                      role="menuitem"
                      data-testid="mark-all-unread"
                      onClick={() => {
                        handleReset();
                        setOverflowOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-neutral-200 hover:bg-neutral-800 transition"
                    >
                      Mark all unread ({readCount})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-50 hover:bg-neutral-800 transition"
              title="Refresh"
              aria-label="Refresh games"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: search input — only when open */}
        {searchOpen && (
          <div className="px-4 pb-2">
            <SearchBar value={search} onChange={handleSearchChange} />
          </div>
        )}
      </div>

      <RevealHero />

      <FollowingLiveBanner />

      <RevealOnboarding />

      <StaleBanner stale={stale} staleAt={staleAt} onRetry={() => refetch()} />

      {/* Loading state */}
      {loading && !error && (
        <div className="px-4 py-4 space-y-3">
          <LoadingSkeleton count={10} variant="timelineRow" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="px-4 py-12 text-center space-y-4">
          <p className="text-sm text-neutral-400">
            {retryCount >= 3
              ? "We can\u2019t reach the server right now. It may be temporarily unavailable."
              : followingLive
                ? "We\u2019re having trouble loading live scores right now."
                : "We\u2019re having trouble connecting to the server."}
          </p>
          <button
            onClick={manualRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-neutral-800 text-neutral-200 hover:text-neutral-50 border border-neutral-700 transition disabled:opacity-50"
          >
            {loading ? <><Spinner size={14} /> Retrying…</> : "Retry"}
          </button>
          <p className="text-xs text-neutral-600">
            {retryCount >= 3
              ? "Automatic retries exhausted. You can still retry manually."
              : retryCount > 0
                ? "Retrying automatically…"
                : followingLive
                  ? "Live scores will update automatically when the connection is restored."
                  : "Check back shortly \u2014 data updates every few minutes."}
          </p>

          {league && (
            <p className="text-xs text-neutral-500">
              Showing: <span className="font-medium text-neutral-300">{league.toUpperCase()}</span> &mdash; filters will apply once data loads.{" "}
              <button onClick={() => setLeague("")} className="text-blue-400 hover:text-blue-300">Clear filter</button>
            </p>
          )}
          {/* Feature explainer when data is unavailable */}
          <div className="mt-6 mx-auto max-w-sm text-left space-y-3 border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
            <p className="text-xs font-medium text-neutral-300">While you wait, here&apos;s what Scroll Down Sports offers:</p>
            <ul className="text-xs text-neutral-500 space-y-1.5 list-none">
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-px">&#9679;</span> Spoiler-free scores — reveal results on your schedule</li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-px">&#9679;</span> Live MLB, NBA, NHL, and NCAAB games</li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-px">&#9679;</span> Play-by-play timelines for every game</li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-px">&#9679;</span> FairBet odds comparison across sportsbooks</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasAnyGames && (
        <div className="px-4 py-12 text-center space-y-3">
          <p className="text-sm text-neutral-400">
            {search
              ? "No games match your search"
              : league
                ? `No ${league.toUpperCase()} games scheduled right now`
                : "No games scheduled right now"}
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
            {search
              ? "Try a different search term or clear your filter."
              : league
                ? `There are no ${league.toUpperCase()} games in the current window. Try "All" to see other sports.`
                : "Check back when MLB, NBA, NHL, or NCAAB games are on the schedule. Games typically start in the afternoon and evening."}
          </p>
          {(search || league) && (
            <button
              onClick={() => { setSearch(""); setLeague(""); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {search ? "Clear search" : "Show all sports"}
            </button>
          )}
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
          useFeedAdSlots={section.key === "Today"}
        />
      ))}
    </div>
  );
}

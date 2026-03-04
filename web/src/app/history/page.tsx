"use client";

import { useMemo, useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useHistoricalGames } from "@/hooks/useHistoricalGames";
import type { GameCore } from "@/stores/game-data";

import { DateNavigator } from "@/components/history/DateNavigator";
import { SearchBar } from "@/components/home/SearchBar";
import { GameRow } from "@/components/home/GameRow";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { cn } from "@/lib/utils";

// ── Date helpers ────────────────────────────────────────────

function easternToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  now.setHours(0, 0, 0, 0);
  return now;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayStr(): string {
  const today = easternToday();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  return fmt(y);
}

// ── All supported leagues ──────────────────────────────────

const ALL_LEAGUES = ["mlb", "nba", "ncaab", "nhl"];

// ── Sort modes ─────────────────────────────────────────────

type SortMode = "away" | "home" | "time";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "away", label: "Away" },
  { value: "home", label: "Home" },
  { value: "time", label: "Time" },
];

function sortGames(games: GameCore[], mode: SortMode): GameCore[] {
  return [...games].sort((a, b) => {
    switch (mode) {
      case "away":
        return a.awayTeam.localeCompare(b.awayTeam);
      case "home":
        return a.homeTeam.localeCompare(b.homeTeam);
      case "time":
        return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
    }
  });
}

// ── Inner component (uses useSearchParams) ─────────────────

function HistoryPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const defaultDate = yesterdayStr();
  const startDate = searchParams.get("start") || defaultDate;
  const endDate = searchParams.get("end") || startDate;
  const [league, setLeague] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("away");

  const { games, loading, loadingMore, error, total, hasMore, loadMore } =
    useHistoricalGames(
      startDate,
      endDate,
      league || undefined,
      search || undefined,
    );

  const handleDateChange = useCallback(
    (newStart: string, newEnd: string) => {
      const params = new URLSearchParams();
      params.set("start", newStart);
      params.set("end", newEnd);
      router.replace(`/history?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const sortedGames = useMemo(() => sortGames(games, sortMode), [games, sortMode]);

  const formattedRange = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      year: "numeric",
    };
    const s = new Date(startDate + "T12:00:00").toLocaleDateString("en-US", opts);
    if (startDate === endDate) return s;
    const e = new Date(endDate + "T12:00:00").toLocaleDateString("en-US", opts);
    return `${s} – ${e}`;
  }, [startDate, endDate]);

  // Infinite scroll: load more when sentinel enters viewport
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky toolbar */}
      <div className="sticky z-30 bg-neutral-950 px-4 py-3 space-y-3 border-b border-neutral-800" style={{ top: "var(--header-h)" }}>
        <DateNavigator startDate={startDate} endDate={endDate} onChange={handleDateChange} />
        <SearchBar value={search} onChange={setSearch} />

        {/* League pills + sort pills on one row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
          {ALL_LEAGUES.map((code) => (
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

          {/* Divider */}
          <div className="shrink-0 w-px h-4 bg-neutral-700" />

          {/* Sort label + pills */}
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium transition",
                sortMode === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
      {!loading && !error && games.length === 0 && (
        <div className="px-4 py-8 text-center text-neutral-500 text-sm">
          No games found for {formattedRange}
        </div>
      )}

      {/* Game list */}
      {sortedGames.map((game) => (
        <GameRow key={game.id} game={game} showPin={false} />
      ))}

      {/* Load more sentinel + indicator */}
      {hasMore && (
        <div ref={sentinelRef} className="px-4 py-4">
          {loadingMore && (
            <div className="space-y-3">
              <LoadingSkeleton count={3} variant="timelineRow" />
            </div>
          )}
        </div>
      )}

      {/* Result count */}
      {!loading && games.length > 0 && (
        <div className="px-4 py-3 text-center text-xs text-neutral-600">
          {games.length} of {total} games
        </div>
      )}
    </div>
  );
}

// ── Page export (Suspense boundary for useSearchParams) ────

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryPageInner />
    </Suspense>
  );
}

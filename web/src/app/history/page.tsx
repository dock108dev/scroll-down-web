"use client";

import { useMemo, useState, useCallback, Suspense } from "react";
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

// ── Derive leagues from games ──────────────────────────────

function deriveLeagues(games: GameCore[]): string[] {
  const set = new Set<string>();
  for (const g of games) {
    if (g.leagueCode) set.add(g.leagueCode.toLowerCase());
  }
  return Array.from(set).sort();
}

// ── Inner component (uses useSearchParams) ─────────────────

function HistoryPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const dateParam = searchParams.get("date") || yesterdayStr();
  const [league, setLeague] = useState("");
  const [search, setSearch] = useState("");

  const { games, loading, error } = useHistoricalGames(
    dateParam,
    league || undefined,
    search || undefined,
  );

  const handleDateChange = useCallback(
    (newDate: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", newDate);
      router.replace(`/history?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const availableLeagues = useMemo(() => deriveLeagues(games), [games]);

  const formattedDate = useMemo(() => {
    const d = new Date(dateParam + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [dateParam]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky toolbar */}
      <div className="sticky z-30 bg-neutral-950 px-4 py-3 space-y-3 border-b border-neutral-800" style={{ top: "var(--header-h)" }}>
        <DateNavigator date={dateParam} onChange={handleDateChange} loading={loading} />
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
          No games found for {formattedDate}
        </div>
      )}

      {/* Game list */}
      {games.map((game) => (
        <GameRow key={game.id} game={game} />
      ))}
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

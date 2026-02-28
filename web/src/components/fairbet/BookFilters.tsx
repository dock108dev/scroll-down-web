"use client";

import { cn } from "@/lib/utils";
import { FairBetTheme } from "@/lib/theme";
import type { SortMode } from "@/hooks/useFairBetOdds";

// ── Market filter definitions ──────────────────────────────────────

const MARKET_FILTERS = [
  { key: "", label: "All" },
  { key: "moneyline", label: "Moneyline" },
  { key: "spread", label: "Spread" },
  { key: "total", label: "Total" },
] as const;

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "bestEV", label: "Best EV" },
  { key: "gameTime", label: "Game Time" },
  { key: "league", label: "League" },
];

// ── Props ──────────────────────────────────────────────────────────

interface BookFiltersProps {
  // League
  availableLeagues: string[];
  selectedLeague: string;
  onLeagueChange: (league: string) => void;
  // Market
  availableMarkets: string[];
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  // Search
  searchText: string;
  onSearchChange: (text: string) => void;
  // Sort
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  // Toggles
  evOnly: boolean;
  onEvOnlyChange: (v: boolean) => void;
  hideThin: boolean;
  onHideThinChange: (v: boolean) => void;
  // Parlay
  parlayCount: number;
  onParlayClick: () => void;
  // Refresh
  onRefresh: () => void;
}

export function BookFilters({
  availableLeagues,
  selectedLeague,
  onLeagueChange,
  availableMarkets,
  selectedMarket,
  onMarketChange,
  searchText,
  onSearchChange,
  sort,
  onSortChange,
  evOnly,
  onEvOnlyChange,
  hideThin,
  onHideThinChange,
  parlayCount,
  onParlayClick,
  onRefresh,
}: BookFiltersProps) {
  return (
    <div className="space-y-3">
      {/* League filter row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        <FilterPill
          label="All"
          active={selectedLeague === ""}
          onClick={() => onLeagueChange("")}
        />
        {availableLeagues.map((l) => (
          <FilterPill
            key={l}
            label={l.toUpperCase()}
            active={selectedLeague === l}
            onClick={() => onLeagueChange(l)}
          />
        ))}

        {/* Separator */}
        {availableLeagues.length > 0 && availableMarkets.length > 0 && (
          <div
            className="self-stretch w-px shrink-0 mx-1"
            style={{ backgroundColor: "var(--fb-border-subtle)" }}
          />
        )}

        {/* Market filters (only show available) */}
        {MARKET_FILTERS.filter(
          (mf) => mf.key === "" || availableMarkets.includes(mf.key),
        ).map((mf) => (
          <FilterPill
            key={mf.key || "all-market"}
            label={mf.label}
            active={selectedMarket === mf.key}
            onClick={() => onMarketChange(mf.key)}
          />
        ))}
      </div>

      {/* Control row: search + sort + parlay badge + refresh */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search teams, players..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          />
          {searchText && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 text-xs"
            >
              x
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="rounded-lg px-2 py-1.5 text-xs text-neutral-200 outline-none cursor-pointer appearance-none"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: "1px solid var(--fb-border-subtle)",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Parlay badge */}
        <button
          onClick={onParlayClick}
          className="relative shrink-0 p-1.5 rounded-lg text-xs"
          style={{
            backgroundColor: parlayCount >= 2 ? `${FairBetTheme.info}20` : "var(--fb-surface-secondary)",
            border: `1px solid ${parlayCount >= 2 ? FairBetTheme.info + "40" : "var(--fb-border-subtle)"}`,
            color: parlayCount >= 2 ? FairBetTheme.info : "var(--ds-text-tertiary)",
          }}
          title="Parlay builder"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {parlayCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
              style={{ backgroundColor: FairBetTheme.info }}
            >
              {parlayCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="shrink-0 p-1.5 rounded-lg text-xs text-neutral-500"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: "1px solid var(--fb-border-subtle)",
          }}
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 4v5h5M20 20v-5h-5" />
            <path d="M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
          </svg>
        </button>
      </div>

      {/* Toggle pills row */}
      <div className="flex items-center gap-2">
        <TogglePill label="+EV Only" active={evOnly} onClick={() => onEvOnlyChange(!evOnly)} />
        <TogglePill label="Hide Thin" active={hideThin} onClick={() => onHideThinChange(!hideThin)} />
      </div>
    </div>
  );
}

// ── Reusable sub-components ────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap",
      )}
      style={
        active
          ? {
              backgroundColor: FairBetTheme.info,
              color: "#fff",
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }
      }
    >
      {label}
    </button>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition"
      style={
        active
          ? {
              backgroundColor: `${FairBetTheme.positive}20`,
              color: FairBetTheme.positive,
              border: `1px solid ${FairBetTheme.positive}40`,
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }
      }
    >
      {label}
    </button>
  );
}

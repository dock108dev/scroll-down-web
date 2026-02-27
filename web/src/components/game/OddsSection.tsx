"use client";

import { useMemo, useState } from "react";
import type { OddsEntry } from "@/lib/types";
import { OddsTable } from "./OddsTable";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";

interface OddsSectionProps {
  odds: OddsEntry[];
  leagueCode?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  mainline: "Game Lines",
  player_prop: "Player Props",
  team_prop: "Team Props",
  alternate: "Alternates",
  period: "Period",
  game_prop: "Game Props",
};

const CATEGORY_ORDER = [
  "mainline",
  "player_prop",
  "team_prop",
  "alternate",
  "period",
  "game_prop",
];

/** Mainline markets are grouped by type for cleaner display */
const MAINLINE_MARKET_ORDER = ["spread", "moneyline", "total", "team_total"];
const MAINLINE_MARKET_LABELS: Record<string, string> = {
  spread: "Spread",
  moneyline: "Moneyline",
  total: "Total",
  team_total: "Team Total",
};

export function OddsSection({ odds }: OddsSectionProps) {
  const hideLimitedData = useSettings((s) => s.hideLimitedData);

  // Determine available categories and sort them
  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(odds.map((o) => o.marketCategory ?? "mainline")),
    );
    return cats.sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
        (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b)),
    );
  }, [odds]);

  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] ?? "mainline",
  );

  const [playerSearch, setPlayerSearch] = useState("");

  const isMainline = activeCategory === "mainline";

  // Filter by active category, search, and thin-market settings
  const filtered = useMemo(() => {
    let result = odds.filter(
      (o) => (o.marketCategory ?? "mainline") === activeCategory,
    );

    // For player props, filter by search
    if (activeCategory === "player_prop" && playerSearch.trim()) {
      const query = playerSearch.toLowerCase();
      result = result.filter(
        (o) =>
          o.playerName?.toLowerCase().includes(query) ||
          o.description?.toLowerCase().includes(query),
      );
    }

    // Optional: hide thin markets (fewer than 2 books)
    if (hideLimitedData) {
      const grouped: Record<string, OddsEntry[]> = {};
      for (const o of result) {
        const key = `${o.marketType}|${o.side ?? ""}|${o.line ?? ""}|${o.playerName ?? ""}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(o);
      }
      const thinKeys = new Set(
        Object.entries(grouped)
          .filter(([, entries]) => {
            const uniqueBooks = new Set(entries.map((e) => e.book));
            return uniqueBooks.size < 2;
          })
          .map(([k]) => k),
      );
      if (thinKeys.size > 0) {
        result = result.filter((o) => {
          const key = `${o.marketType}|${o.side ?? ""}|${o.line ?? ""}|${o.playerName ?? ""}`;
          return !thinKeys.has(key);
        });
      }
    }

    return result;
  }, [odds, activeCategory, playerSearch, hideLimitedData]);

  const mainlineGroups = useMemo(() => {
    if (!isMainline) return [];

    const groups: { marketType: string; label: string; entries: OddsEntry[] }[] =
      [];
    const byType: Record<string, OddsEntry[]> = {};

    for (const o of filtered) {
      const mt = o.marketType;
      if (!byType[mt]) byType[mt] = [];
      byType[mt].push(o);
    }

    // Sort by preferred order
    const sortedTypes = Object.keys(byType).sort(
      (a, b) =>
        (MAINLINE_MARKET_ORDER.indexOf(a) === -1
          ? 99
          : MAINLINE_MARKET_ORDER.indexOf(a)) -
        (MAINLINE_MARKET_ORDER.indexOf(b) === -1
          ? 99
          : MAINLINE_MARKET_ORDER.indexOf(b)),
    );

    for (const mt of sortedTypes) {
      groups.push({
        marketType: mt,
        label: MAINLINE_MARKET_LABELS[mt] ?? mt.replace(/_/g, " "),
        entries: byType[mt],
      });
    }
    return groups;
  }, [isMainline, filtered]);

  if (odds.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No odds data available
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setPlayerSearch("");
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                activeCategory === cat
                  ? "bg-white text-black"
                  : "bg-neutral-800 text-neutral-400 hover:text-white",
              )}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* Player prop search */}
      {activeCategory === "player_prop" && (
        <input
          type="text"
          placeholder="Search by player name..."
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
        />
      )}

      {/* Mainline: grouped by market type with headers */}
      {isMainline ? (
        mainlineGroups.length > 0 ? (
          <div className="space-y-4">
            {mainlineGroups.map((group) => (
              <div key={group.marketType}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <OddsTable odds={group.entries} groupSides />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500 py-2">
            No game lines available
          </div>
        )
      ) : filtered.length > 0 ? (
        <OddsTable
          odds={filtered}
          showPlayerNames={activeCategory === "player_prop"}
        />
      ) : (
        <div className="text-sm text-neutral-500 py-2">
          No data for this category
        </div>
      )}
    </div>
  );
}

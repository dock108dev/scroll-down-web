"use client";

import { useMemo, useState } from "react";
import type { OddsEntry } from "@/lib/types";
import { OddsTable } from "./OddsTable";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";

interface OddsSectionProps {
  odds: OddsEntry[];
  leagueCode?: string;
  homeTeam?: string;
  awayTeam?: string;
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

const ALTERNATE_MARKET_LABELS: Record<string, string> = {
  alternate_spread: "Alternate Spread",
  alternate_total: "Alternate Total",
};

/** Sort spread entries: away side first, home side second, by line ascending within each */
function sortBySpreadSide(
  entries: OddsEntry[],
  awayTeam?: string,
  homeTeam?: string,
): OddsEntry[] {
  return [...entries].sort((a, b) => {
    const aIsAway = a.side === awayTeam ? 0 : a.side === homeTeam ? 1 : 2;
    const bIsAway = b.side === awayTeam ? 0 : b.side === homeTeam ? 1 : 2;
    if (aIsAway !== bIsAway) return aIsAway - bIsAway;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

/** Sort total entries: Over first, Under second, by line ascending within each */
function sortByTotalSide(entries: OddsEntry[]): OddsEntry[] {
  return [...entries].sort((a, b) => {
    const aIsOver = a.side?.toLowerCase() === "over" ? 0 : 1;
    const bIsOver = b.side?.toLowerCase() === "over" ? 0 : 1;
    if (aIsOver !== bIsOver) return aIsOver - bIsOver;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

export function OddsSection({ odds, homeTeam, awayTeam }: OddsSectionProps) {
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
      let entries = byType[mt];
      if (mt === "spread") {
        entries = sortBySpreadSide(entries, awayTeam, homeTeam);
      } else if (mt === "total" || mt === "team_total") {
        entries = sortByTotalSide(entries);
      }
      groups.push({
        marketType: mt,
        label: MAINLINE_MARKET_LABELS[mt] ?? mt.replace(/_/g, " "),
        entries,
      });
    }
    return groups;
  }, [isMainline, filtered, awayTeam, homeTeam]);

  // Player props: group by player name with sub-headers
  const playerPropGroups = useMemo(() => {
    if (activeCategory !== "player_prop") return [];

    const byPlayer: Record<string, OddsEntry[]> = {};
    for (const o of filtered) {
      const name = o.playerName ?? "Unknown";
      if (!byPlayer[name]) byPlayer[name] = [];
      byPlayer[name].push(o);
    }

    return Object.keys(byPlayer)
      .sort((a, b) => a.localeCompare(b))
      .map((player) => ({
        label: player,
        entries: byPlayer[player].sort((a, b) => {
          const mtCmp = a.marketType.localeCompare(b.marketType);
          if (mtCmp !== 0) return mtCmp;
          return (a.line ?? 0) - (b.line ?? 0);
        }),
      }));
  }, [activeCategory, filtered]);

  // Alternates: group by market type, side-sorted within
  const alternateGroups = useMemo(() => {
    if (activeCategory !== "alternate") return [];

    const byType: Record<string, OddsEntry[]> = {};
    for (const o of filtered) {
      const mt = o.marketType;
      if (!byType[mt]) byType[mt] = [];
      byType[mt].push(o);
    }

    return Object.entries(byType).map(([mt, entries]) => ({
      marketType: mt,
      label: ALTERNATE_MARKET_LABELS[mt] ?? mt.replace(/_/g, " "),
      entries:
        mt === "alternate_spread"
          ? sortBySpreadSide(entries, awayTeam, homeTeam)
          : mt === "alternate_total"
            ? sortByTotalSide(entries)
            : entries,
    }));
  }, [activeCategory, filtered, awayTeam, homeTeam]);

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
                  ? "bg-neutral-50 text-neutral-950"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
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
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
        />
      )}

      {/* Mainline: grouped by market type with side-sorted entries */}
      {isMainline ? (
        mainlineGroups.length > 0 ? (
          <div className="space-y-4">
            {mainlineGroups.map((group) => (
              <div key={group.marketType}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <OddsTable
                  odds={group.entries}
                  groupSides={group.marketType === "moneyline"}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500 py-2">
            No game lines available
          </div>
        )
      ) : activeCategory === "player_prop" ? (
        playerPropGroups.length > 0 ? (
          <div className="space-y-4">
            {playerPropGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <OddsTable
                  odds={group.entries}
                  showPlayerNames
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500 py-2">
            No data for this category
          </div>
        )
      ) : activeCategory === "team_prop" && homeTeam && awayTeam ? (
        <TeamPropGrouped
          odds={filtered}
          allOdds={odds}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      ) : activeCategory === "alternate" ? (
        alternateGroups.length > 0 ? (
          <div className="space-y-4">
            {alternateGroups.map((group) => (
              <div key={group.marketType}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <OddsTable
                  odds={group.entries}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500 py-2">
            No data for this category
          </div>
        )
      ) : filtered.length > 0 ? (
        <OddsTable
          odds={filtered}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      ) : (
        <div className="text-sm text-neutral-500 py-2">
          No data for this category
        </div>
      )}
    </div>
  );
}

/**
 * Group all team prop entries by team using side field for direct assignment
 * and midpoint heuristic for team_total Over/Under entries.
 */
function TeamPropGrouped({
  odds,
  allOdds,
  homeTeam,
  awayTeam,
}: {
  odds: OddsEntry[];
  allOdds: OddsEntry[];
  homeTeam: string;
  awayTeam: string;
}) {
  const groups = useMemo(() => {
    const home: OddsEntry[] = [];
    const away: OddsEntry[] = [];
    const other: OddsEntry[] = [];

    // For team_total Over/Under, compute midpoint from mainline lines
    const mainlineTeamTotals = allOdds.filter(
      (o) =>
        o.marketType === "team_total" &&
        (o.marketCategory ?? "mainline") === "mainline",
    );
    const mainlineLines = [
      ...new Set(
        mainlineTeamTotals
          .map((o) => o.line)
          .filter((l): l is number => l != null),
      ),
    ].sort((a, b) => a - b);
    const midpoint =
      mainlineLines.length >= 2
        ? (mainlineLines[0] + mainlineLines[mainlineLines.length - 1]) / 2
        : null;

    for (const o of odds) {
      // Direct assignment via side or description matching team names
      if (o.side === homeTeam || o.description === homeTeam) {
        home.push(o);
        continue;
      }
      if (o.side === awayTeam || o.description === awayTeam) {
        away.push(o);
        continue;
      }

      // For team_total Over/Under entries, use midpoint heuristic
      if (o.marketType === "team_total" && midpoint != null && o.line != null) {
        if (o.line <= midpoint) {
          away.push(o);
        } else {
          home.push(o);
        }
        continue;
      }

      other.push(o);
    }

    // Strip descriptions that just repeat the team name — the team is
    // already in the group header, so let buildLabel show side + line instead.
    const strip = (entries: OddsEntry[]) =>
      entries.map((e) =>
        e.description === homeTeam || e.description === awayTeam
          ? { ...e, description: undefined }
          : e,
      );

    const result: { label: string; entries: OddsEntry[] }[] = [];
    if (away.length > 0) result.push({ label: awayTeam, entries: strip(away) });
    if (home.length > 0) result.push({ label: homeTeam, entries: strip(home) });
    if (other.length > 0) result.push({ label: "Other", entries: strip(other) });
    return result;
  }, [odds, allOdds, homeTeam, awayTeam]);

  if (groups.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-2">
        No data for this category
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            {group.label}
          </h3>
          <OddsTable odds={group.entries} homeTeam={homeTeam} awayTeam={awayTeam} />
        </div>
      ))}
    </div>
  );
}

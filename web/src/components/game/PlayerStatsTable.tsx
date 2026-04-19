"use client";

import { useState } from "react";
import type { PlayerStat } from "@/lib/types";
import { HEADLINE_STATS } from "@/lib/config";

// ─── Sport-specific column definitions ──────────────────────────

interface StatColumn {
  label: string;
  /** Ordered list of keys to try in rawStats (first match wins) */
  aliases: string[];
  /** Optional formatter — defaults to raw value or "-" */
  format?: (value: unknown) => string;
}

const NBA_COLUMNS: StatColumn[] = [
  { label: "MIN", aliases: ["minutes", "min", "mins", "minutesPlayed"] },
  { label: "PTS", aliases: ["points", "pts"] },
  { label: "REB", aliases: ["rebounds", "reb", "totalRebounds", "total_rebounds"] },
  { label: "AST", aliases: ["assists", "ast"] },
  { label: "STL", aliases: ["steals", "stl"] },
  { label: "BLK", aliases: ["blocks", "blk", "blockedShots"] },
  { label: "TO", aliases: ["turnovers", "to", "tov", "turnover"] },
  {
    label: "FGM-A",
    aliases: ["_compound_fgma"],
  },
  {
    label: "3PM-A",
    aliases: ["_compound_3pma"],
  },
  {
    label: "FTM-A",
    aliases: ["_compound_ftma"],
  },
  { label: "+/-", aliases: ["plusMinus", "plus_minus", "plusminus"] },
];

const NCAAB_COLUMNS: StatColumn[] = [
  { label: "MIN", aliases: ["minutes", "min", "mins", "minutesPlayed"] },
  { label: "PTS", aliases: ["points", "pts"] },
  { label: "REB", aliases: ["rebounds", "reb", "totalRebounds", "total_rebounds"] },
  { label: "AST", aliases: ["assists", "ast"] },
  { label: "STL", aliases: ["steals", "stl"] },
  { label: "BLK", aliases: ["blocks", "blk", "blockedShots"] },
  { label: "TO", aliases: ["turnovers", "to", "tov", "turnover"] },
  { label: "FGM-A", aliases: ["_compound_fgma"] },
  { label: "3PM-A", aliases: ["_compound_3pma"] },
  { label: "FTM-A", aliases: ["_compound_ftma"] },
];

const NFL_COLUMNS: StatColumn[] = [
  { label: "POS", aliases: ["position", "pos"] },
  { label: "YDS", aliases: ["yards", "yds", "totalYards", "total_yards"] },
  { label: "TD", aliases: ["touchdowns", "td", "tds"] },
  { label: "CMP", aliases: ["completions", "cmp", "passCompletions"] },
  { label: "ATT", aliases: ["attempts", "att", "passAttempts"] },
  { label: "P-YDS", aliases: ["passingYards", "passing_yards", "passYds"] },
  { label: "R-YDS", aliases: ["rushingYards", "rushing_yards", "rushYds"] },
  { label: "REC", aliases: ["receptions", "rec"] },
  { label: "REC-YDS", aliases: ["receivingYards", "receiving_yards", "recYds"] },
  { label: "INT", aliases: ["interceptions", "int"] },
  { label: "TCK", aliases: ["tackles", "tck", "totalTackles"] },
  { label: "SCK", aliases: ["sacks", "sck"] },
];

// ─── Stat alias helpers ─────────────────────────────────────────────

/** Aliases for field-goal made */
const FGM_ALIASES = ["fgm", "fg", "fg_made", "fgMade", "fieldGoalsMade"];
/** Aliases for field-goal attempted */
const FGA_ALIASES = ["fga", "fg_att", "fgAtt", "fgAttempted", "fieldGoalsAttempted"];
/** Aliases for 3-point made */
const TPM_ALIASES = ["tpm", "threePointersMade", "three_pointers_made", "threePm", "fg3m", "fg3_made"];
/** Aliases for 3-point attempted */
const TPA_ALIASES = ["tpa", "threePointersAttempted", "three_pointers_attempted", "threePa", "fg3a", "fg3_att"];
/** Aliases for free-throw made */
const FTM_ALIASES = ["ftm", "ft", "ft_made", "ftMade", "freeThrowsMade"];
/** Aliases for free-throw attempted */
const FTA_ALIASES = ["fta", "ft_att", "ftAtt", "ftAttempted", "freeThrowsAttempted"];

function resolveAlias(raw: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of aliases) {
    const val = raw[key];
    if (val == null) continue;
    // If the value is an object (e.g. {offensive: 1, defensive: 3}), extract numeric total
    if (typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      if (typeof obj.total === "number") return obj.total;
      if (typeof obj.value === "number") return obj.value;
      // Sum numeric children (e.g. offensive + defensive)
      const nums = Object.values(obj).filter((v): v is number => typeof v === "number");
      if (nums.length > 0) return nums.reduce((a, b) => a + b, 0);
      continue; // skip this object value, try next alias
    }
    return val;
  }
  return undefined;
}

function resolveCompound(
  raw: Record<string, unknown>,
  madeAliases: string[],
  attAliases: string[],
): string | undefined {
  const made = resolveAlias(raw, madeAliases);
  const att = resolveAlias(raw, attAliases);
  if (made == null && att == null) return undefined;
  return `${made ?? 0}-${att ?? 0}`;
}

function resolveStatValue(raw: Record<string, unknown>, col: StatColumn): string | undefined {
  // Handle compound stat columns
  if (col.aliases[0] === "_compound_fgma") {
    return resolveCompound(raw, FGM_ALIASES, FGA_ALIASES);
  }
  if (col.aliases[0] === "_compound_3pma") {
    return resolveCompound(raw, TPM_ALIASES, TPA_ALIASES);
  }
  if (col.aliases[0] === "_compound_ftma") {
    return resolveCompound(raw, FTM_ALIASES, FTA_ALIASES);
  }

  const value = resolveAlias(raw, col.aliases);
  if (value == null) return undefined;
  if (col.format) return col.format(value);
  return String(value);
}

// ─── Name abbreviation ──────────────────────────────────────────────

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;

  const firstName = parts[0];
  const rest = parts.slice(1);

  // Check for suffixes like "Jr.", "Sr.", "III", "II", "IV"
  const suffixPattern = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
  const lastParts: string[] = [];
  const suffixes: string[] = [];

  for (const part of rest) {
    if (suffixPattern.test(part)) {
      suffixes.push(part.endsWith(".") ? part : `${part}.`);
    } else {
      lastParts.push(part);
    }
  }

  const lastName = lastParts.join(" ");
  const suffix = suffixes.length > 0 ? ` ${suffixes.join(" ")}` : "";

  return `${firstName[0]}. ${lastName}${suffix}`;
}

// ─── Column detection ───────────────────────────────────────────────

function getColumnsForSport(leagueCode: string): StatColumn[] {
  switch (leagueCode.toLowerCase()) {
    case "nba":
      return NBA_COLUMNS;
    case "ncaab":
      return NCAAB_COLUMNS;
    case "nfl":
    case "ncaaf":
      return NFL_COLUMNS;
    default:
      return NBA_COLUMNS;
  }
}

/** Filter columns to only those that have data in at least one player */
function detectActiveColumns(
  columns: StatColumn[],
  players: PlayerStat[],
): StatColumn[] {
  return columns.filter((col) =>
    players.some((p) => {
      const raw = p.rawStats ?? {};
      const val = resolveStatValue(raw, col);
      return val != null && val !== "-" && val !== "0-0";
    }),
  );
}

// ─── Also check top-level fields on PlayerStat for fallback ─────────

function getDisplayValue(player: PlayerStat, col: StatColumn): string {
  const raw = player.rawStats ?? {};
  const resolved = resolveStatValue(raw, col);
  if (resolved != null) return resolved;

  // Fallback to top-level typed fields
  for (const alias of col.aliases) {
    if (alias === "minutes" && player.minutes != null) return String(player.minutes);
    if (alias === "points" && player.points != null) return String(player.points);
    if (alias === "rebounds" && player.rebounds != null) return String(player.rebounds);
    if (alias === "assists" && player.assists != null) return String(player.assists);
    if (alias === "yards" && player.yards != null) return String(player.yards);
    if (alias === "touchdowns" && player.touchdowns != null) return String(player.touchdowns);
  }

  return "-";
}

// ─── Headline / rest split ──────────────────────────────────────────

/** Split active columns into headline (shown collapsed) and rest (shown expanded). */
function splitColumns(
  activeColumns: StatColumn[],
  headlineLabels: readonly string[],
): { headline: StatColumn[]; rest: StatColumn[] } {
  const headlineSet = new Set(headlineLabels);
  const headline = activeColumns.filter((c) => headlineSet.has(c.label));
  const rest = activeColumns.filter((c) => !headlineSet.has(c.label));
  // Fallback: no headline cols matched data — show first 3 active cols
  if (headline.length === 0 && activeColumns.length > 0) {
    return { headline: activeColumns.slice(0, 3), rest: activeColumns.slice(3) };
  }
  return { headline, rest };
}

// ─── Component ──────────────────────────────────────────────────────

interface PlayerStatsTableProps {
  title: string;
  players: PlayerStat[];
  leagueCode?: string;
}

/** Deduplicate players by name — merge rawStats, preferring scalar values over objects */
function deduplicatePlayers(players: PlayerStat[]): PlayerStat[] {
  const byName = new Map<string, PlayerStat>();
  for (const p of players) {
    const existing = byName.get(p.playerName);
    if (!existing) {
      byName.set(p.playerName, { ...p, rawStats: { ...p.rawStats } });
      continue;
    }
    // Merge rawStats: for each key, prefer scalar values over objects
    const merged = existing.rawStats ?? {};
    for (const [k, v] of Object.entries(p.rawStats ?? {})) {
      const current = merged[k];
      if (current == null) {
        merged[k] = v;
      } else if (typeof current === "object" && typeof v !== "object" && v != null) {
        // Replace object with scalar
        merged[k] = v;
      }
    }
    existing.rawStats = merged;
    // Also prefer non-null top-level fields
    if (p.minutes != null && existing.minutes == null) existing.minutes = p.minutes;
    if (p.points != null && existing.points == null) existing.points = p.points;
    if (p.rebounds != null && existing.rebounds == null) existing.rebounds = p.rebounds;
    if (p.assists != null && existing.assists == null) existing.assists = p.assists;
  }
  return Array.from(byName.values());
}

/** Extract numeric minutes value for sorting */
function getMinutesValue(player: PlayerStat): number {
  if (player.minutes != null) return player.minutes;
  const raw = player.rawStats ?? {};
  const val = resolveAlias(raw, ["minutes", "min", "mins", "minutesPlayed"]);
  if (val == null) return -1;
  const str = String(val);
  // Handle "MM:SS" format
  if (str.includes(":")) {
    const [m, s] = str.split(":");
    return Number(m) + Number(s) / 60;
  }
  const num = Number(val);
  return isNaN(num) ? -1 : num;
}

export function PlayerStatsTable({
  title,
  players: rawPlayers,
  leagueCode = "nba",
}: PlayerStatsTableProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const players = deduplicatePlayers(rawPlayers)
    .sort((a, b) => getMinutesValue(b) - getMinutesValue(a));
  if (players.length === 0) return null;

  const sportColumns = getColumnsForSport(leagueCode);
  const activeColumns = detectActiveColumns(sportColumns, players);
  const headlineLabels = HEADLINE_STATS[leagueCode.toLowerCase()] ?? HEADLINE_STATS.nba;
  const { headline: headlineCols, rest: restCols } = splitColumns(activeColumns, headlineLabels);

  function togglePlayer(name: string) {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <div data-testid="player-stats-table" className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Table header with team name */}
      <div className="px-3 py-2 text-sm font-semibold text-neutral-300 bg-neutral-800/50">
        {title}
      </div>

      {/* Player rows */}
      <div>
        {players.map((p, idx) => {
          const isExpanded = expandedPlayers.has(p.playerName);
          return (
            <div
              key={`${p.playerName}-${idx}`}
              className="border-b border-neutral-800/50 last:border-b-0"
            >
              {/* Collapsed row — always visible */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/30 transition-colors"
                onClick={() => togglePlayer(p.playerName)}
                aria-expanded={isExpanded}
                data-testid="player-row"
              >
                <span
                  className="flex-1 truncate text-sm text-neutral-300 min-w-0"
                  title={p.playerName}
                >
                  {abbreviateName(p.playerName)}
                </span>
                <div className="flex gap-3 shrink-0">
                  {headlineCols.map((col) => (
                    <div key={col.label} className="flex flex-col items-center min-w-[28px]">
                      <span className="text-[10px] text-neutral-500 leading-tight">{col.label}</span>
                      <span className="text-sm tabular-nums text-neutral-200 font-medium leading-tight">
                        {getDisplayValue(p, col)}
                      </span>
                    </div>
                  ))}
                </div>
                {restCols.length > 0 && (
                  <span
                    className={`text-[10px] text-neutral-500 shrink-0 transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
                  >
                    &#9660;
                  </span>
                )}
              </button>

              {/* Expanded extra stats */}
              {isExpanded && restCols.length > 0 && (
                <div
                  className="px-3 pb-2 pt-1 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs bg-neutral-800/20"
                  data-testid="player-row-expanded"
                >
                  {restCols.map((col) => (
                    <div key={col.label} className="flex justify-between gap-1">
                      <span className="text-neutral-500">{col.label}</span>
                      <span className="tabular-nums text-neutral-300">
                        {getDisplayValue(p, col)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

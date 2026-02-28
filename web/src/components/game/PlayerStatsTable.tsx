import type { PlayerStat } from "@/lib/types";

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
  { label: "R-YDS", aliases: ["receivingYards", "receiving_yards", "recYds"] },
  { label: "INT", aliases: ["interceptions", "int"] },
  { label: "TCK", aliases: ["tackles", "tck", "totalTackles"] },
  { label: "SCK", aliases: ["sacks", "sck"] },
];

// ─── Stat alias helpers ─────────────────────────────────────────

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
    if (raw[key] != null) return raw[key];
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

// ─── Name abbreviation ──────────────────────────────────────────

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

// ─── Column detection ───────────────────────────────────────────

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

// ─── Also check top-level fields on PlayerStat for fallback ─────

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

// ─── Component ──────────────────────────────────────────────────

interface PlayerStatsTableProps {
  title: string;
  players: PlayerStat[];
  leagueCode?: string;
}

export function PlayerStatsTable({
  title,
  players,
  leagueCode = "nba",
}: PlayerStatsTableProps) {
  if (players.length === 0) return null;

  const sportColumns = getColumnsForSport(leagueCode);
  const activeColumns = detectActiveColumns(sportColumns, players);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Table header with team name */}
      <div className="px-3 py-2 text-sm font-semibold text-neutral-300 bg-neutral-800/50">
        {title}
      </div>

      {/* Scrollable table wrapper */}
      <div className="relative overflow-x-auto hide-scrollbar">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              {/* Frozen player name column */}
              <th
                className="text-left px-3 py-2 font-medium bg-neutral-900 sticky left-0 z-10 min-w-[120px] max-w-[140px]"
                style={{
                  boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                }}
              >
                Player
              </th>
              {/* Stat columns */}
              {activeColumns.map((col) => (
                <th
                  key={col.label}
                  className="text-right px-2 py-2 font-medium whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.playerName}
                className="border-b border-neutral-800/50 text-neutral-300"
              >
                {/* Frozen player name cell */}
                <td
                  className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                  style={{
                    boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                  }}
                  title={p.playerName}
                >
                  {abbreviateName(p.playerName)}
                </td>
                {/* Stat cells */}
                {activeColumns.map((col) => (
                  <td
                    key={col.label}
                    className="text-right px-2 py-1.5 font-mono whitespace-nowrap"
                  >
                    {getDisplayValue(p, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { NormalizedStat } from "@/lib/types";

// ─── Stat category grouping ────────────────────────────────────

export interface StatDef {
  key: string;
  label: string;
  /** Ordered alias keys to try in team stats */
  aliases: string[];
  /** If true, lower is better (e.g. turnovers) */
  lowerIsBetter?: boolean;
  /** Format as percentage with % suffix */
  isPercentage?: boolean;
}

export interface StatGroup {
  title: string;
  stats: StatDef[];
}

export const BASKETBALL_GROUPS: StatGroup[] = [
  {
    title: "Overview",
    stats: [
      { key: "pts", label: "PTS", aliases: ["points", "pts", "totalPoints"] },
      { key: "reb", label: "REB", aliases: ["rebounds", "reb", "totalRebounds", "total_rebounds"] },
      { key: "ast", label: "AST", aliases: ["assists", "ast"] },
      { key: "stl", label: "STL", aliases: ["steals", "stl"] },
      { key: "blk", label: "BLK", aliases: ["blocks", "blk", "blockedShots"] },
      { key: "to", label: "TO", aliases: ["turnovers", "to", "tov"], lowerIsBetter: true },
    ],
  },
  {
    title: "Shooting",
    stats: [
      { key: "fgm", label: "FGM", aliases: ["fgm", "fg", "fgMade", "fieldGoalsMade"] },
      { key: "fga", label: "FGA", aliases: ["fga", "fgAtt", "fgAttempted", "fieldGoalsAttempted"] },
      { key: "fgPct", label: "FG%", aliases: ["fgPct", "fg_pct", "fieldGoalPercentage", "fgPercentage"], isPercentage: true },
      { key: "tpm", label: "3PM", aliases: ["tpm", "threePointersMade", "threePm", "fg3m"] },
      { key: "tpa", label: "3PA", aliases: ["tpa", "threePointersAttempted", "threePa", "fg3a"] },
      { key: "tpPct", label: "3P%", aliases: ["tpPct", "tp_pct", "threePointPercentage", "fg3Pct"], isPercentage: true },
      { key: "ftm", label: "FTM", aliases: ["ftm", "ft", "ftMade", "freeThrowsMade"] },
      { key: "fta", label: "FTA", aliases: ["fta", "ftAtt", "ftAttempted", "freeThrowsAttempted"] },
      { key: "ftPct", label: "FT%", aliases: ["ftPct", "ft_pct", "freeThrowPercentage", "ftPercentage"], isPercentage: true },
    ],
  },
  {
    title: "Extra",
    stats: [
      { key: "oreb", label: "Off Reb", aliases: ["offReb", "oreb", "offensiveRebounds", "offensive_rebounds"] },
      { key: "dreb", label: "Def Reb", aliases: ["defReb", "dreb", "defensiveRebounds", "defensive_rebounds"] },
      { key: "pf", label: "Fouls", aliases: ["fouls", "pf", "personalFouls"], lowerIsBetter: true },
      { key: "fastBreak", label: "Fast Break", aliases: ["fastBreakPoints", "fast_break_points", "fastBreak"] },
      { key: "bench", label: "Bench Pts", aliases: ["benchPoints", "bench_points", "bench"] },
      { key: "pip", label: "PIP", aliases: ["pointsInPaint", "points_in_paint", "pip"] },
    ],
  },
];

export const HOCKEY_GROUPS: StatGroup[] = [
  {
    title: "Offense",
    stats: [
      { key: "sog", label: "SOG", aliases: ["shotsOnGoal", "sog", "shots_on_goal"] },
      { key: "pts", label: "Points", aliases: ["points", "pts"] },
      { key: "goals", label: "Goals", aliases: ["goals", "g"] },
      { key: "ast", label: "Assists", aliases: ["assists", "ast", "a"] },
      { key: "pp", label: "Power Play", aliases: ["powerPlayGoals", "pp_goals", "ppGoals"] },
    ],
  },
  {
    title: "Discipline",
    stats: [
      { key: "pim", label: "PIM", aliases: ["penaltyMinutes", "pim", "penalty_minutes"], lowerIsBetter: true },
      { key: "hits", label: "Hits", aliases: ["hits", "hit"] },
      { key: "blk", label: "Blocked", aliases: ["blockedShots", "blk", "blocked_shots"] },
      { key: "fo", label: "FO%", aliases: ["faceoffPct", "fo_pct", "faceoffPercentage"], isPercentage: true },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────

export function resolveStatValue(
  stats: Record<string, unknown>,
  aliases: string[],
): number | undefined {
  for (const key of aliases) {
    const val = stats[key];
    if (val != null) {
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    }
  }
  return undefined;
}

export function formatStatValue(
  value: number | undefined,
  isPercentage?: boolean,
): string {
  if (value == null) return "-";
  if (isPercentage) {
    // Values could come as 0-1 or 0-100
    const pct = value > 1 ? value : value * 100;
    return `${pct.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getGroupsForSport(leagueCode: string): StatGroup[] {
  switch (leagueCode.toLowerCase()) {
    case "nhl":
      return HOCKEY_GROUPS;
    case "nba":
    case "ncaab":
    default:
      return BASKETBALL_GROUPS;
  }
}

// ─── Build groups from normalizedStats ──────────────────────────

const GROUP_DISPLAY_TITLES: Record<string, string> = {
  scoring: "Scoring",
  shooting: "Shooting",
  rebounds: "Rebounds",
  playmaking: "Playmaking",
  defense: "Defense",
};

const GROUP_ORDER = ["scoring", "shooting", "rebounds", "playmaking", "defense"];

const LOWER_IS_BETTER_KEYS = new Set([
  "turnovers",
  "personal_fouls",
  "penalty_minutes",
]);

export interface NormalizedRow {
  key: string;
  label: string;
  homeValue: number | undefined;
  awayValue: number | undefined;
  lowerIsBetter: boolean;
  isPercentage: boolean;
}

export interface NormalizedGroup {
  title: string;
  rows: NormalizedRow[];
}

function parseNormalizedValue(val: number | string | null): number | undefined {
  if (val == null) return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}

export function buildGroupsFromNormalized(
  homeStats: NormalizedStat[],
  awayStats: NormalizedStat[],
): NormalizedGroup[] {
  // Index away stats by key for quick lookup
  const awayByKey = new Map<string, NormalizedStat>();
  for (const s of awayStats) awayByKey.set(s.key, s);

  // Collect all unique keys preserving home order, then away extras
  const seen = new Set<string>();
  const allStats: NormalizedStat[] = [];
  for (const s of homeStats) {
    if (!seen.has(s.key)) {
      seen.add(s.key);
      allStats.push(s);
    }
  }
  for (const s of awayStats) {
    if (!seen.has(s.key)) {
      seen.add(s.key);
      allStats.push(s);
    }
  }

  // Group rows by group name
  const groupMap = new Map<string, NormalizedRow[]>();

  for (const stat of allStats) {
    const homeVal = parseNormalizedValue(
      homeStats.find((s) => s.key === stat.key)?.value ?? null,
    );
    const awayVal = parseNormalizedValue(awayByKey.get(stat.key)?.value ?? null);

    // Skip "points" if both are 0 (data not yet available)
    if (stat.key === "points" && (homeVal ?? 0) === 0 && (awayVal ?? 0) === 0) {
      continue;
    }

    // Skip rows where neither team has data
    if (homeVal == null && awayVal == null) continue;

    const groupKey = stat.group || "other";
    if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);

    groupMap.get(groupKey)!.push({
      key: stat.key,
      label: stat.displayLabel,
      homeValue: homeVal,
      awayValue: awayVal,
      lowerIsBetter: LOWER_IS_BETTER_KEYS.has(stat.key),
      isPercentage: stat.formatType === "pct",
    });
  }

  // Order groups according to GROUP_ORDER, then any extras alphabetically
  const ordered: NormalizedGroup[] = [];
  for (const gk of GROUP_ORDER) {
    const rows = groupMap.get(gk);
    if (rows && rows.length > 0) {
      ordered.push({
        title: GROUP_DISPLAY_TITLES[gk] || gk,
        rows,
      });
      groupMap.delete(gk);
    }
  }
  // Remaining groups not in GROUP_ORDER
  for (const [gk, rows] of [...groupMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (rows.length > 0) {
      ordered.push({
        title: GROUP_DISPLAY_TITLES[gk] || gk.charAt(0).toUpperCase() + gk.slice(1),
        rows,
      });
    }
  }

  return ordered;
}

// ─── Stat annotations ──────────────────────────────────────────

export interface Annotation {
  text: string;
}

export function generateAnnotations(
  homeStats: Record<string, unknown>,
  awayStats: Record<string, unknown>,
  homeTeam: string,
  awayTeam: string,
  leagueCode: string,
): Annotation[] {
  const annotations: Annotation[] = [];

  function getVal(stats: Record<string, unknown>, aliases: string[]): number {
    return resolveStatValue(stats, aliases) ?? 0;
  }

  function teamName(isHome: boolean): string {
    return isHome ? homeTeam : awayTeam;
  }

  if (leagueCode === "nhl") return annotations;

  // Off Reb diff >= 5
  const homeOreb = getVal(homeStats, ["offReb", "oreb", "offensiveRebounds", "offensive_rebounds"]);
  const awayOreb = getVal(awayStats, ["offReb", "oreb", "offensiveRebounds", "offensive_rebounds"]);
  const orebDiff = Math.abs(homeOreb - awayOreb);
  if (orebDiff >= 5) {
    const winner = homeOreb > awayOreb;
    annotations.push({
      text: `+${orebDiff} extra possessions for ${teamName(winner)}`,
    });
  }

  // Turnovers diff > 2
  const homeTo = getVal(homeStats, ["turnovers", "to", "tov"]);
  const awayTo = getVal(awayStats, ["turnovers", "to", "tov"]);
  const toDiff = Math.abs(homeTo - awayTo);
  if (toDiff > 2) {
    const loser = homeTo > awayTo;
    annotations.push({
      text: `${teamName(loser)} +${toDiff} giveaways`,
    });
  }

  // Assists diff >= 5
  const homeAst = getVal(homeStats, ["assists", "ast"]);
  const awayAst = getVal(awayStats, ["assists", "ast"]);
  const astDiff = Math.abs(homeAst - awayAst);
  if (astDiff >= 5) {
    const winner = homeAst > awayAst;
    annotations.push({
      text: `Ball movement favored ${teamName(winner)}`,
    });
  }

  // Rebounds diff >= 8
  const homeReb = getVal(homeStats, ["rebounds", "reb", "totalRebounds", "total_rebounds"]);
  const awayReb = getVal(awayStats, ["rebounds", "reb", "totalRebounds", "total_rebounds"]);
  const rebDiff = Math.abs(homeReb - awayReb);
  if (rebDiff >= 8) {
    const winner = homeReb > awayReb;
    annotations.push({
      text: `${teamName(winner)} controlled the glass`,
    });
  }

  // FG% diff >= 8
  const homeFgPct = getVal(homeStats, ["fgPct", "fg_pct", "fieldGoalPercentage", "fgPercentage"]);
  const awayFgPct = getVal(awayStats, ["fgPct", "fg_pct", "fieldGoalPercentage", "fgPercentage"]);
  const fgDiff = Math.abs(
    (homeFgPct > 1 ? homeFgPct : homeFgPct * 100) -
    (awayFgPct > 1 ? awayFgPct : awayFgPct * 100),
  );
  if (fgDiff >= 8) {
    const winner = homeFgPct > awayFgPct;
    annotations.push({
      text: `${teamName(winner)} more efficient from the field`,
    });
  }

  // 3PT% diff >= 10
  const homeTpPct = getVal(homeStats, ["tpPct", "tp_pct", "threePointPercentage", "fg3Pct"]);
  const awayTpPct = getVal(awayStats, ["tpPct", "tp_pct", "threePointPercentage", "fg3Pct"]);
  const tpDiff = Math.abs(
    (homeTpPct > 1 ? homeTpPct : homeTpPct * 100) -
    (awayTpPct > 1 ? awayTpPct : awayTpPct * 100),
  );
  if (tpDiff >= 10) {
    const winner = homeTpPct > awayTpPct;
    annotations.push({
      text: `${teamName(winner)} hot from deep`,
    });
  }

  return annotations;
}

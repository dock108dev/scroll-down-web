import type { TeamStat } from "@/lib/types";

// ─── Stat category grouping ────────────────────────────────────

interface StatDef {
  key: string;
  label: string;
  /** Ordered alias keys to try in team stats */
  aliases: string[];
  /** If true, lower is better (e.g. turnovers) */
  lowerIsBetter?: boolean;
  /** Format as percentage with % suffix */
  isPercentage?: boolean;
}

interface StatGroup {
  title: string;
  stats: StatDef[];
}

const BASKETBALL_GROUPS: StatGroup[] = [
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

const HOCKEY_GROUPS: StatGroup[] = [
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

function resolveStatValue(
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

function formatStatValue(
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

function getGroupsForSport(leagueCode: string): StatGroup[] {
  switch (leagueCode.toLowerCase()) {
    case "nhl":
      return HOCKEY_GROUPS;
    case "nba":
    case "ncaab":
    default:
      return BASKETBALL_GROUPS;
  }
}

// ─── Stat annotations ──────────────────────────────────────────

interface Annotation {
  text: string;
}

function generateAnnotations(
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
    // More turnovers = worse, so the team with MORE turnovers "has giveaways"
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

// ─── Comparison bar row ─────────────────────────────────────────

function ComparisonRow({
  label,
  awayValue,
  homeValue,
  awayColor,
  homeColor,
  lowerIsBetter,
  isPercentage,
}: {
  label: string;
  awayValue: number | undefined;
  homeValue: number | undefined;
  awayColor: string;
  homeColor: string;
  lowerIsBetter?: boolean;
  isPercentage?: boolean;
}) {
  const av = awayValue ?? 0;
  const hv = homeValue ?? 0;
  const max = Math.max(av, hv, 1); // avoid division by zero

  const awayPct = (av / max) * 100;
  const homePct = (hv / max) * 100;

  // Determine winner
  let awayWins: boolean;
  if (lowerIsBetter) {
    awayWins = av < hv;
  } else {
    awayWins = av > hv;
  }
  const homeWins = !awayWins && av !== hv;
  const tied = av === hv;

  return (
    <div className="px-3 py-2 border-b border-neutral-800/50">
      {/* Labels + values row */}
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span
          className={`tabular-nums min-w-[40px] ${
            awayWins || tied ? "font-bold" : "opacity-50"
          }`}
          style={{ color: awayWins || tied ? undefined : undefined }}
        >
          {formatStatValue(awayValue, isPercentage)}
        </span>
        <span className="text-neutral-500 text-stat-label uppercase tracking-wide">
          {label}
        </span>
        <span
          className={`tabular-nums min-w-[40px] text-right ${
            homeWins || tied ? "font-bold" : "opacity-50"
          }`}
        >
          {formatStatValue(homeValue, isPercentage)}
        </span>
      </div>

      {/* Visual bars */}
      <div className="flex items-center gap-1 h-2">
        {/* Away bar (grows right-to-left) */}
        <div className="flex-1 flex justify-end">
          <div
            className="h-full rounded-sm team-bar-right"
            style={{
              width: `${awayPct}%`,
              backgroundColor: awayColor,
              opacity: awayWins || tied ? 1 : 0.5,
            }}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-neutral-700 shrink-0" />

        {/* Home bar (grows left-to-right) */}
        <div className="flex-1">
          <div
            className="h-full rounded-sm team-bar"
            style={{
              width: `${homePct}%`,
              backgroundColor: homeColor,
              opacity: homeWins || tied ? 1 : 0.5,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

interface TeamStatsComparisonProps {
  teamStats: TeamStat[];
  homeTeam: string;
  awayTeam: string;
  leagueCode?: string;
  homeColor?: string;
  awayColor?: string;
}

export function TeamStatsComparison({
  teamStats,
  homeTeam,
  awayTeam,
  leagueCode = "nba",
  homeColor = "var(--ds-team-b)",
  awayColor = "var(--ds-team-a)",
}: TeamStatsComparisonProps) {
  const home = teamStats.find((t) => t.isHome);
  const away = teamStats.find((t) => !t.isHome);

  if (!home || !away) return null;

  const groups = getGroupsForSport(leagueCode);

  // Filter groups/stats to only those with data
  const activeGroups = groups
    .map((group) => ({
      ...group,
      stats: group.stats.filter((stat) => {
        const hv = resolveStatValue(home.stats, stat.aliases);
        const av = resolveStatValue(away.stats, stat.aliases);
        return hv != null || av != null;
      }),
    }))
    .filter((group) => group.stats.length > 0);

  // Generate annotations
  const annotations = generateAnnotations(
    home.stats,
    away.stats,
    homeTeam,
    awayTeam,
    leagueCode,
  );

  return (
    <div className="space-y-3">
      {/* Team header */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="grid grid-cols-3 px-3 py-2 text-xs font-semibold border-b border-neutral-800 bg-neutral-800/50">
          <span style={{ color: awayColor }}>{awayTeam}</span>
          <span className="text-center text-neutral-500">Team Stats</span>
          <span className="text-right" style={{ color: homeColor }}>
            {homeTeam}
          </span>
        </div>

        {/* Stat groups */}
        {activeGroups.map((group) => (
          <div key={group.title}>
            {/* Group header */}
            <div className="px-3 py-1.5 bg-neutral-800/30 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              {group.title}
            </div>

            {/* Stat rows */}
            {group.stats.map((stat) => (
              <ComparisonRow
                key={stat.key}
                label={stat.label}
                awayValue={resolveStatValue(away.stats, stat.aliases)}
                homeValue={resolveStatValue(home.stats, stat.aliases)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter={stat.lowerIsBetter}
                isPercentage={stat.isPercentage}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Annotations */}
      {annotations.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-1.5">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Key Takeaways
          </div>
          {annotations.map((a, i) => (
            <div
              key={i}
              className="text-xs text-neutral-400 flex items-start gap-2"
            >
              <span className="text-neutral-600 mt-0.5 shrink-0">--</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

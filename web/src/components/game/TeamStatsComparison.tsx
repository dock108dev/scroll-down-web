import type { TeamStat } from "@/lib/types";
import {
  resolveStatValue,
  formatStatValue,
  getGroupsForSport,
  buildGroupsFromNormalized,
  generateAnnotations,
} from "@/lib/team-stats-config";

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

  // Prefer normalizedStats when available; fall back to hardcoded groups
  const useNormalized = !!(home.normalizedStats?.length || away.normalizedStats?.length);

  const normalizedGroups = useNormalized
    ? buildGroupsFromNormalized(
        home.normalizedStats ?? [],
        away.normalizedStats ?? [],
      )
    : null;

  const legacyActiveGroups = useNormalized
    ? []
    : getGroupsForSport(leagueCode)
        .map((group) => ({
          ...group,
          stats: group.stats.filter((stat) => {
            const hv = resolveStatValue(home.stats, stat.aliases);
            const av = resolveStatValue(away.stats, stat.aliases);
            return hv != null || av != null;
          }),
        }))
        .filter((group) => group.stats.length > 0);

  // Generate annotations (always from raw stats)
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

        {/* Stat groups — normalized path */}
        {normalizedGroups?.map((group) => (
          <div key={group.title}>
            <div className="px-3 py-1.5 bg-neutral-800/30 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              {group.title}
            </div>
            {group.rows.map((row) => (
              <ComparisonRow
                key={row.key}
                label={row.label}
                awayValue={row.awayValue}
                homeValue={row.homeValue}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter={row.lowerIsBetter}
                isPercentage={row.isPercentage}
              />
            ))}
          </div>
        ))}

        {/* Stat groups — legacy fallback path */}
        {legacyActiveGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 py-1.5 bg-neutral-800/30 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              {group.title}
            </div>
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

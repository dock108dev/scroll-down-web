import type { TeamStat } from "@/lib/types";
import {
  formatStatValue,
  buildGroupsFromNormalized,
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
  const total = av + hv;

  // Each side as a percentage of the whole bar
  const awayPct = total > 0 ? (av / total) * 100 : 50;
  const homePct = total > 0 ? (hv / total) * 100 : 50;

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
    <div className="px-3 py-2.5 border-b border-neutral-800/50">
      {/* Stat label centered above */}
      <div className="text-center text-neutral-500 text-stat-label uppercase tracking-wide mb-1.5">
        {label}
      </div>

      {/* Values + bar inline */}
      <div className="flex items-center gap-2.5">
        {/* Away value */}
        <span
          className={`text-sm tabular-nums min-w-[40px] ${
            awayWins || tied ? "font-semibold text-neutral-100" : "text-neutral-500"
          }`}
        >
          {formatStatValue(awayValue, isPercentage)}
        </span>

        {/* Bar between values */}
        <div className="flex-1 flex h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${awayPct}%`,
              backgroundColor: awayColor,
              opacity: awayWins || tied ? 0.8 : 0.25,
            }}
          />
          <div className="w-px bg-neutral-700 shrink-0" />
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${homePct}%`,
              backgroundColor: homeColor,
              opacity: homeWins || tied ? 0.8 : 0.25,
            }}
          />
        </div>

        {/* Home value */}
        <span
          className={`text-sm tabular-nums min-w-[40px] text-right ${
            homeWins || tied ? "font-semibold text-neutral-100" : "text-neutral-500"
          }`}
        >
          {formatStatValue(homeValue, isPercentage)}
        </span>
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
  homeColor = "var(--ds-team-b)",
  awayColor = "var(--ds-team-a)",
}: TeamStatsComparisonProps) {
  const home = teamStats.find((t) => t.isHome);
  const away = teamStats.find((t) => !t.isHome);

  if (!home || !away) return null;

  const normalizedGroups = buildGroupsFromNormalized(
    home.normalizedStats ?? [],
    away.normalizedStats ?? [],
  );

  return (
    <div data-testid="team-stats-comparison" className="space-y-3">
      {/* Team header */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="grid grid-cols-3 px-3 py-2 text-xs font-semibold border-b border-neutral-800 bg-neutral-800/50">
          <span style={{ color: awayColor, textShadow: "var(--ds-team-text-outline)" }}>{awayTeam}</span>
          <span className="text-center text-neutral-500">Team Stats</span>
          <span className="text-right" style={{ color: homeColor, textShadow: "var(--ds-team-text-outline)" }}>
            {homeTeam}
          </span>
        </div>

        {normalizedGroups.map((group) => (
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
      </div>

    </div>
  );
}

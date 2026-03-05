import type { MLBAdvancedTeamStats, MLBAdvancedPlayerStats } from "@/lib/types";

// ─── Formatting helpers ─────────────────────────────────────────

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "-";
  const pct = val > 1 ? val : val * 100;
  return `${pct.toFixed(1)}%`;
}

function fmtVelo(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${val.toFixed(1)}`;
}

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const rest = parts.slice(1);
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

// ─── Stat row for team comparison ───────────────────────────────

interface StatRowDef {
  label: string;
  getValue: (s: MLBAdvancedTeamStats) => string;
  tooltip?: string;
}

const TEAM_STAT_ROWS: StatRowDef[] = [
  { label: "Pitches", getValue: (s) => String(s.totalPitches), tooltip: "Total pitches seen" },
  { label: "Balls in Play", getValue: (s) => String(s.ballsInPlay), tooltip: "Batted balls with launch data" },
  { label: "Zone Swing%", getValue: (s) => fmtPct(s.zSwingPct), tooltip: "Swing rate on pitches in the zone" },
  { label: "Chase%", getValue: (s) => fmtPct(s.oSwingPct), tooltip: "Swing rate on pitches outside the zone" },
  { label: "Zone Contact%", getValue: (s) => fmtPct(s.zContactPct), tooltip: "Contact rate on zone swings" },
  { label: "O-Contact%", getValue: (s) => fmtPct(s.oContactPct), tooltip: "Contact rate on outside swings" },
  { label: "Avg Exit Velo", getValue: (s) => fmtVelo(s.avgExitVelo), tooltip: "Average exit velocity (mph)" },
  { label: "Hard Hit%", getValue: (s) => fmtPct(s.hardHitPct), tooltip: "Rate of batted balls ≥95 mph" },
  { label: "Barrel%", getValue: (s) => fmtPct(s.barrelPct), tooltip: "Barrel rate (optimal launch angle + exit velo)" },
];

// ─── Team comparison ────────────────────────────────────────────

interface TeamComparisonProps {
  away: MLBAdvancedTeamStats;
  home: MLBAdvancedTeamStats;
  awayColor?: string;
  homeColor?: string;
}

function TeamComparison({ away, home, awayColor, homeColor }: TeamComparisonProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        Team Comparison
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 border-b border-neutral-800 text-xs font-medium text-neutral-400">
        <span className="text-left" style={{ color: awayColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>{away.team}</span>
        <span className="px-4">Stat</span>
        <span className="text-right" style={{ color: homeColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>{home.team}</span>
      </div>

      {/* Stat rows */}
      {TEAM_STAT_ROWS.map((row) => {
        const awayVal = row.getValue(away);
        const homeVal = row.getValue(home);
        return (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 border-b border-neutral-800/50 text-xs"
            title={row.tooltip}
          >
            <span className="text-left tabular-nums text-neutral-200">{awayVal}</span>
            <span className="px-4 text-neutral-500 text-center whitespace-nowrap">{row.label}</span>
            <span className="text-right tabular-nums text-neutral-200">{homeVal}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Player table ───────────────────────────────────────────────

interface PlayerTableProps {
  title: string;
  players: MLBAdvancedPlayerStats[];
}

function PlayerTable({ title, players }: PlayerTableProps) {
  if (players.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title}
      </div>

      <div className="relative overflow-x-auto hide-scrollbar">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th
                className="text-left px-3 py-2 font-medium bg-neutral-900 sticky left-0 z-10 min-w-[120px] max-w-[140px]"
                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
              >
                Player
              </th>
              <th className="text-right px-2 py-2 font-medium" title="Total pitches seen">PC</th>
              <th className="text-right px-2 py-2 font-medium" title="Balls in play">BIP</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Zone swing rate">Z-Sw%</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Chase rate">Chase%</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Zone contact rate">Z-Con%</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Outside contact rate">O-Con%</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Average exit velocity">EV</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Hard hit rate (≥95 mph)">HH%</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap" title="Barrel rate">Brl%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.playerName}
                className="border-b border-neutral-800/50 text-neutral-300"
              >
                <td
                  className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                  style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
                  title={p.playerName}
                >
                  {abbreviateName(p.playerName)}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">{p.totalPitches}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{p.ballsInPlay}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtPct(p.zSwingPct)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtPct(p.oSwingPct)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtPct(p.zContactPct)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtPct(p.oContactPct)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtVelo(p.avgExitVelo)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtPct(p.hardHitPct)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums font-semibold">{fmtPct(p.barrelPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main section ───────────────────────────────────────────────

interface MLBAdvancedStatsSectionProps {
  teamStats?: MLBAdvancedTeamStats[];
  playerStats?: MLBAdvancedPlayerStats[];
  homeTeam: string;
  awayTeam: string;
  homeColor?: string;
  awayColor?: string;
}

export function MLBAdvancedStatsSection({
  teamStats,
  playerStats,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
}: MLBAdvancedStatsSectionProps) {
  const homeTeamStats = teamStats?.find((s) => s.isHome);
  const awayTeamStats = teamStats?.find((s) => !s.isHome);
  const homePlayers = playerStats?.filter((p) => p.isHome) ?? [];
  const awayPlayers = playerStats?.filter((p) => !p.isHome) ?? [];

  const hasTeamData = homeTeamStats != null && awayTeamStats != null;
  const hasPlayerData = homePlayers.length > 0 || awayPlayers.length > 0;

  if (!hasTeamData && !hasPlayerData) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No advanced stats available
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      {hasTeamData && (
        <TeamComparison
          away={awayTeamStats}
          home={homeTeamStats}
          awayColor={awayColor}
          homeColor={homeColor}
        />
      )}

      {hasPlayerData && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PlayerTable title={`${awayTeam} - Statcast`} players={awayPlayers} />
          <PlayerTable title={`${homeTeam} - Statcast`} players={homePlayers} />
        </div>
      )}
    </div>
  );
}

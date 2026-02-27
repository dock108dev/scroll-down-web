"use client";

import type {
  PlayerStat,
  TeamStat,
  NHLSkaterStat,
  NHLGoalieStat,
} from "@/lib/types";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { TeamStatsComparison } from "./TeamStatsComparison";
import { NHLSkatersTable, NHLGoaliesTable } from "./NHLStatsTable";

interface StatsSectionProps {
  playerStats: PlayerStat[];
  teamStats: TeamStat[];
  homeTeam: string;
  awayTeam: string;
  leagueCode?: string;
  homeColor?: string;
  awayColor?: string;
  nhlSkaters?: NHLSkaterStat[];
  nhlGoalies?: NHLGoalieStat[];
}

export function StatsSection({
  playerStats,
  teamStats,
  homeTeam,
  awayTeam,
  leagueCode = "nba",
  homeColor,
  awayColor,
  nhlSkaters,
  nhlGoalies,
}: StatsSectionProps) {
  const isNHL = leagueCode.toLowerCase() === "nhl";
  const hasPlayerStats = playerStats.length > 0;
  const hasTeamStats = teamStats.length > 0;
  const hasNHLSkaters = (nhlSkaters?.length ?? 0) > 0;
  const hasNHLGoalies = (nhlGoalies?.length ?? 0) > 0;
  const hasAnyData =
    hasPlayerStats || hasTeamStats || hasNHLSkaters || hasNHLGoalies;

  if (!hasAnyData) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No stats available
      </div>
    );
  }

  // Split NHL players by team
  const homeSkaters = nhlSkaters?.filter((s) => s.team === homeTeam) ?? [];
  const awaySkaters = nhlSkaters?.filter((s) => s.team !== homeTeam) ?? [];
  const homeGoalies = nhlGoalies?.filter((g) => g.team === homeTeam) ?? [];
  const awayGoalies = nhlGoalies?.filter((g) => g.team !== homeTeam) ?? [];

  // Split generic players by team
  const homePlayers = playerStats.filter((p) => p.team === homeTeam);
  const awayPlayers = playerStats.filter((p) => p.team !== homeTeam);

  return (
    <div className="px-4 space-y-4">
      {/* Team stats comparison (all sports) */}
      {hasTeamStats && (
        <TeamStatsComparison
          teamStats={teamStats}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          leagueCode={leagueCode}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      )}

      {/* NHL-specific: Skaters tables */}
      {isNHL && hasNHLSkaters && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <NHLSkatersTable title={awayTeam} skaters={awaySkaters} />
          <NHLSkatersTable title={homeTeam} skaters={homeSkaters} />
        </div>
      )}

      {/* NHL-specific: Goalies tables */}
      {isNHL && hasNHLGoalies && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <NHLGoaliesTable title={awayTeam} goalies={awayGoalies} />
          <NHLGoaliesTable title={homeTeam} goalies={homeGoalies} />
        </div>
      )}

      {/* Generic player stats (NBA, NCAAB, NFL, etc.) */}
      {!isNHL && hasPlayerStats && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PlayerStatsTable
            title={awayTeam}
            players={awayPlayers}
            leagueCode={leagueCode}
          />
          <PlayerStatsTable
            title={homeTeam}
            players={homePlayers}
            leagueCode={leagueCode}
          />
        </div>
      )}
    </div>
  );
}

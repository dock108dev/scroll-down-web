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

// ─── Player Stats Section ──────────────────────────────────

interface PlayerStatsSectionProps {
  playerStats: PlayerStat[];
  homeTeam: string;
  awayTeam: string;
  leagueCode?: string;
  nhlSkaters?: NHLSkaterStat[];
  nhlGoalies?: NHLGoalieStat[];
}

export function PlayerStatsSection({
  playerStats,
  homeTeam,
  awayTeam,
  leagueCode = "nba",
  nhlSkaters,
  nhlGoalies,
}: PlayerStatsSectionProps) {
  const isNHL = leagueCode.toLowerCase() === "nhl";
  const hasPlayerStats = playerStats.length > 0;
  const hasNHLSkaters = (nhlSkaters?.length ?? 0) > 0;
  const hasNHLGoalies = (nhlGoalies?.length ?? 0) > 0;
  const hasAnyData = hasPlayerStats || hasNHLSkaters || hasNHLGoalies;

  if (!hasAnyData) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No player stats available
      </div>
    );
  }

  const homeSkaters = nhlSkaters?.filter((s) => s.team === homeTeam) ?? [];
  const awaySkaters = nhlSkaters?.filter((s) => s.team !== homeTeam) ?? [];
  const homeGoalies = nhlGoalies?.filter((g) => g.team === homeTeam) ?? [];
  const awayGoalies = nhlGoalies?.filter((g) => g.team !== homeTeam) ?? [];
  const homePlayers = playerStats.filter((p) => p.team === homeTeam);
  const awayPlayers = playerStats.filter((p) => p.team !== homeTeam);

  return (
    <div className="px-4 space-y-4">
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

// ─── Team Stats Section ────────────────────────────────────

interface TeamStatsSectionProps {
  teamStats: TeamStat[];
  homeTeam: string;
  awayTeam: string;
  leagueCode?: string;
  homeColor?: string;
  awayColor?: string;
}

export function TeamStatsSection({
  teamStats,
  homeTeam,
  awayTeam,
  leagueCode = "nba",
  homeColor,
  awayColor,
}: TeamStatsSectionProps) {
  if (teamStats.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No team stats available
      </div>
    );
  }

  return (
    <div className="px-4">
      <TeamStatsComparison
        teamStats={teamStats}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        leagueCode={leagueCode}
        homeColor={homeColor}
        awayColor={awayColor}
      />
    </div>
  );
}

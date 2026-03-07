"use client";

import type { ScoreOutcome } from "../types";

interface UniverseCardProps {
  rank: number;
  outcome: ScoreOutcome;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
}

export function UniverseCard({
  rank,
  outcome,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
}: UniverseCardProps) {
  const homeWins = outcome.home > outcome.away;
  const pct = (outcome.frequency * 100).toFixed(1);

  return (
    <div className="card px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          Universe #{rank}
        </span>
        <span className="text-xs text-neutral-500 tabular-nums">
          {pct}% of simulations
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1 h-6 rounded-full shrink-0"
            style={{ backgroundColor: awayColor }}
          />
          <span className="text-sm text-neutral-300 truncate">{awayTeam}</span>
        </div>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: !homeWins ? awayColor : undefined }}
        >
          {outcome.away}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1 h-6 rounded-full shrink-0"
            style={{ backgroundColor: homeColor }}
          />
          <span className="text-sm text-neutral-300 truncate">{homeTeam}</span>
        </div>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: homeWins ? homeColor : undefined }}
        >
          {outcome.home}
        </span>
      </div>
    </div>
  );
}

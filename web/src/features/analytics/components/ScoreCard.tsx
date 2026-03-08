"use client";

interface ScoreCardProps {
  rank: number;
  score: string;
  probability: number;
  awayTeam: string;
  homeTeam: string;
  awayColor: string;
  homeColor: string;
}

export function ScoreCard({
  rank,
  score,
  probability,
  awayTeam,
  homeTeam,
  awayColor,
  homeColor,
}: ScoreCardProps) {
  const pct = (probability * 100).toFixed(1);

  // score format is "away-home" e.g. "4-5"
  const [awayScore, homeScore] = score.split("-").map(Number);
  const homeWins = homeScore > awayScore;

  return (
    <div className="card px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          #{rank}
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
          {awayScore}
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
          {homeScore}
        </span>
      </div>
    </div>
  );
}

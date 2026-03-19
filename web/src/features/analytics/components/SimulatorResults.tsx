/**
 * Renders the full results panel for an MLB simulation:
 * win probability, expected score, most common scores,
 * PA breakdown, and pitching profiles.
 */

import { useMemo } from "react";
import type { SimulatorResult } from "@/features/analytics/types";
import { ProbabilityBar } from "./ProbabilityBar";
import { ScoreCard } from "./ScoreCard";
import { PABreakdown } from "./PABreakdown";
import { PitcherProfile } from "./PitcherProfile";

interface SimulatorResultsProps {
  result: SimulatorResult;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
}

export function SimulatorResults({
  result,
  homeName,
  awayName,
  homeColor,
  awayColor,
}: SimulatorResultsProps) {
  // Split scores into home-win vs away-win buckets.
  // Score format is "away-home", so homeScore > awayScore = home win.
  const { most_common_scores } = result;
  const { homeWinScores, awayWinScores } = useMemo(() => {
    const hw: typeof most_common_scores = [];
    const aw: typeof most_common_scores = [];
    for (const s of most_common_scores) {
      const [awayScore, homeScore] = s.score.split("-").map(Number);
      if (homeScore > awayScore) hw.push(s);
      else aw.push(s);
    }
    return { homeWinScores: hw.slice(0, 3), awayWinScores: aw.slice(0, 3) };
  }, [most_common_scores]);

  return (
    <div className="space-y-5">
      {/* Lineup mode badge */}
      {result.profile_meta?.lineup_mode?.enabled && (
        <div className="inline-flex items-center gap-1.5 text-[11px] text-green-500 bg-green-500/10 rounded-full px-2.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Lineup mode active — {result.profile_meta.lineup_mode.home_batters_resolved}/9 home,{" "}
          {result.profile_meta.lineup_mode.away_batters_resolved}/9 away batters resolved
        </div>
      )}

      {/* Win Probability */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Win Probability
        </h4>
        <div className="space-y-2">
          <ProbabilityBar
            label={awayName}
            probability={result.away_win_probability}
            color={awayColor}
          />
          <ProbabilityBar
            label={homeName}
            probability={result.home_win_probability}
            color={homeColor}
          />
        </div>
        {result.profile_meta?.model_win_probability != null && (
          <p className="text-[11px] text-neutral-600">
            ML model: {homeName}{" "}
            {Math.round(result.profile_meta.model_win_probability * 100)}%
          </p>
        )}
      </div>

      {/* Average Score */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Expected Score
        </h4>
        <div className="flex gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-neutral-400">{awayName}</span>
            <span className="text-lg font-semibold text-neutral-200 tabular-nums">
              {result.average_away_score.toFixed(1)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-neutral-400">{homeName}</span>
            <span className="text-lg font-semibold text-neutral-200 tabular-nums">
              {result.average_home_score.toFixed(1)}
            </span>
          </div>
          <div className="flex items-baseline gap-2 ml-auto">
            <span className="text-xs text-neutral-500">O/U</span>
            <span className="text-sm font-medium text-neutral-400 tabular-nums">
              {result.average_total.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* PA Probabilities */}
      {result.home_pa_probabilities && result.away_pa_probabilities && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Plate Appearance Profiles
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <PABreakdown
              label={awayName}
              probs={result.away_pa_probabilities}
            />
            <PABreakdown
              label={homeName}
              probs={result.home_pa_probabilities}
            />
          </div>
        </div>
      )}

      {/* Pitching Analytics */}
      {(result.profile_meta?.away_pitcher || result.profile_meta?.home_pitcher) && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Pitching Profiles
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {result.profile_meta?.away_pitcher && (
              <PitcherProfile
                label={awayName}
                info={result.profile_meta.away_pitcher}
                bullpen={result.profile_meta.away_bullpen}
              />
            )}
            {result.profile_meta?.home_pitcher && (
              <PitcherProfile
                label={homeName}
                info={result.profile_meta.home_pitcher}
                bullpen={result.profile_meta.home_bullpen}
              />
            )}
          </div>
        </div>
      )}

      {/* Most Common Scores — split by winner */}
      {result.most_common_scores.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Most Likely Final Scores
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-neutral-400 font-medium">
                If {homeName} wins
              </p>
              {homeWinScores.map((s, i) => (
                <ScoreCard
                  key={s.score}
                  rank={i + 1}
                  score={s.score}
                  probability={s.probability}
                  awayTeam={awayName}
                  homeTeam={homeName}
                  awayColor={awayColor}
                  homeColor={homeColor}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-neutral-400 font-medium">
                If {awayName} wins
              </p>
              {awayWinScores.map((s, i) => (
                <ScoreCard
                  key={s.score}
                  rank={i + 1}
                  score={s.score}
                  probability={s.probability}
                  awayTeam={awayName}
                  homeTeam={homeName}
                  awayColor={awayColor}
                  homeColor={homeColor}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-[11px] text-neutral-600 pt-2 border-t border-neutral-800/50">
        <span>{result.iterations.toLocaleString()} iterations</span>
        {result.probability_source && (
          <span>Source: {result.probability_source}</span>
        )}
        {result.profile_meta?.lineup_mode &&
          !result.profile_meta.lineup_mode.enabled && (
            <span className="text-amber-600">
              Lineup mode inactive — using team averages
            </span>
          )}
      </div>
    </div>
  );
}

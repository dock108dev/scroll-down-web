"use client";

import { useCallback, useEffect, useState } from "react";
import { ProbabilityBar } from "../components/ProbabilityBar";
import { UniverseCard } from "../components/UniverseCard";
import {
  runGameSimulation,
  getCachedSimulation,
} from "../services/SimulationService";
import type { SimulationResult, AnalyticsGameContext } from "../types";
import { cardDisplayName } from "@/lib/utils";

const MAX_UNIVERSES = 10;

interface SimulationAppProps {
  ctx: AnalyticsGameContext;
  onBack: () => void;
}

export function SimulationApp({ ctx, onBack }: SimulationAppProps) {
  const [result, setResult] = useState<SimulationResult | null>(
    () => getCachedSimulation(ctx.gameId) ?? null,
  );
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState<string | null>(null);

  const fetchSimulation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await runGameSimulation(
        ctx.gameId,
        ctx.leagueCode,
        ctx.homeTeam,
        ctx.awayTeam,
      );
      setResult(data);
    } catch {
      setError("Unable to load simulation. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [ctx.gameId, ctx.leagueCode, ctx.homeTeam, ctx.awayTeam]);

  useEffect(() => {
    if (!result) fetchSimulation();
  }, [result, fetchSimulation]);

  const homeDisplay = cardDisplayName(
    ctx.homeTeam,
    ctx.leagueCode,
    ctx.homeTeamAbbr,
  );
  const awayDisplay = cardDisplayName(
    ctx.awayTeam,
    ctx.leagueCode,
    ctx.awayTeamAbbr,
  );

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        &larr; All Tools
      </button>

      <h3 className="text-section-header">Alternate Game Universes</h3>

      {loading && (
        <div className="space-y-3">
          <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />
          <div className="h-5 bg-neutral-800 rounded animate-pulse" />
          <div className="h-5 bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse mt-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-neutral-800 rounded animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-neutral-500 py-6">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <>
          {/* Win Probability */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Win Probability
            </h4>
            <div className="space-y-2">
              <ProbabilityBar
                label={homeDisplay}
                probability={result.win_probability_home}
                color={ctx.homeColor}
              />
              <ProbabilityBar
                label={awayDisplay}
                probability={result.win_probability_away}
                color={ctx.awayColor}
              />
            </div>
          </div>

          {/* Average Score */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Average Score
            </h4>
            <div className="flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-neutral-400">{homeDisplay}</span>
                <span className="text-lg font-semibold text-neutral-200 tabular-nums">
                  {result.average_home_score.toFixed(1)}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-neutral-400">{awayDisplay}</span>
                <span className="text-lg font-semibold text-neutral-200 tabular-nums">
                  {result.average_away_score.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Universes */}
          {result.score_distribution.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Most Likely Universes
              </h4>
              <div className="space-y-2">
                {result.score_distribution
                  .sort((a, b) => b.frequency - a.frequency)
                  .slice(0, MAX_UNIVERSES)
                  .map((outcome, i) => (
                    <UniverseCard
                      key={`${outcome.home}-${outcome.away}`}
                      rank={i + 1}
                      outcome={outcome}
                      homeTeam={homeDisplay}
                      awayTeam={awayDisplay}
                      homeColor={ctx.homeColor}
                      awayColor={ctx.awayColor}
                    />
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

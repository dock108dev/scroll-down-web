"use client";

import { useCallback, useEffect, useState } from "react";
import { ProbabilityBar } from "./ProbabilityBar";
import { UniverseCard } from "./UniverseCard";
import { runGameSimulation, getCachedSimulation } from "./SimulationService";
import type { SimulationResult } from "./types";
import { cardDisplayName } from "@/lib/utils";

interface AnalyticsTabProps {
  gameId: number;
  leagueCode: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor: string;
  awayColor: string;
}

const MAX_UNIVERSES = 10;

export function AnalyticsTab({
  gameId,
  leagueCode,
  homeTeam,
  awayTeam,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: AnalyticsTabProps) {
  const [result, setResult] = useState<SimulationResult | null>(
    () => getCachedSimulation(gameId) ?? null,
  );
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState<string | null>(null);

  const fetchSimulation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await runGameSimulation(
        gameId,
        leagueCode,
        homeTeam,
        awayTeam,
      );
      setResult(data);
    } catch {
      setError("Unable to load analytics. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [gameId, leagueCode, homeTeam, awayTeam]);

  useEffect(() => {
    if (!result) {
      fetchSimulation();
    }
  }, [result, fetchSimulation]);

  const homeDisplay = cardDisplayName(homeTeam, leagueCode, homeTeamAbbr);
  const awayDisplay = cardDisplayName(awayTeam, leagueCode, awayTeamAbbr);

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-3">
        <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />
        <div className="h-5 bg-neutral-800 rounded animate-pulse" />
        <div className="h-5 bg-neutral-800 rounded animate-pulse" />
        <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse mt-6" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="px-4 py-8 text-center text-sm text-neutral-500">
        {error ?? "Unable to load analytics."}
      </div>
    );
  }

  const topOutcomes = result.score_distribution
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_UNIVERSES);

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Win Probability */}
      <div className="space-y-2">
        <h3 className="text-section-header">Win Probability</h3>
        <div className="space-y-2">
          <ProbabilityBar
            teamName={homeDisplay}
            probability={result.win_probability_home}
            color={homeColor}
          />
          <ProbabilityBar
            teamName={awayDisplay}
            probability={result.win_probability_away}
            color={awayColor}
          />
        </div>
      </div>

      {/* Average Score */}
      <div className="space-y-2">
        <h3 className="text-section-header">Average Score</h3>
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

      {/* Alternate Game Universes */}
      {topOutcomes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-section-header">Alternate Game Universes</h3>
          <div className="space-y-2">
            {topOutcomes.map((outcome, i) => (
              <UniverseCard
                key={`${outcome.home}-${outcome.away}`}
                rank={i + 1}
                outcome={outcome}
                homeTeam={homeDisplay}
                awayTeam={awayDisplay}
                homeColor={homeColor}
                awayColor={awayColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

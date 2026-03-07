"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProbabilityBar } from "../../components/ProbabilityBar";
import { MatchupAnimation } from "./animation/MatchupAnimation";
import { OUTCOME_COLORS, OUTCOME_LABELS } from "./animation/AnimationController";
import {
  getPitchPrediction,
  getRunExpectancy,
} from "../../services/PredictionService";
import type {
  AnalyticsGameContext,
  PitchProbabilities,
} from "../../types";
import { cardDisplayName } from "@/lib/utils";
import { useGameData } from "@/stores/game-data";

const POLL_INTERVAL = 15_000;

interface LivePredictionAppProps {
  ctx: AnalyticsGameContext;
  onBack: () => void;
}

interface GameState {
  inning: number;
  half: "top" | "bottom" | null;
  outs: number | null;
  balls: number | null;
  strikes: number | null;
  baseState: number | null;
  homeScore: number;
  awayScore: number;
}

function parseBaseStateLabel(state: number | null): string {
  if (state == null) return "—";
  if (state === 0) return "Bases empty";
  const parts: string[] = [];
  if (state & 1) parts.push("1st");
  if (state & 2) parts.push("2nd");
  if (state & 4) parts.push("3rd");
  return `Runner${parts.length > 1 ? "s" : ""} on ${parts.join(", ")}`;
}

function formatHalf(half: "top" | "bottom" | null): string {
  if (half == null) return "—";
  return half === "top" ? "Top" : "Bot";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function LivePredictionApp({ ctx, onBack }: LivePredictionAppProps) {
  const [pitchProbs, setPitchProbs] = useState<PitchProbabilities | null>(null);
  const [runExp, setRunExp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const core = useGameData((s) => s.getCore(ctx.gameId));

  // Derive what we can from core; fields the backend doesn't provide are null
  const gameState: GameState = {
    inning: core?.currentPeriod ?? 1,
    half: null,
    outs: null,
    balls: null,
    strikes: null,
    baseState: null,
    homeScore: core?.homeScore ?? 0,
    awayScore: core?.awayScore ?? 0,
  };

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

  const fetchPredictions = useCallback(async () => {
    try {
      const pitchParams: Record<string, number> = {};
      if (gameState.balls != null) pitchParams.count_balls = gameState.balls;
      if (gameState.strikes != null) pitchParams.count_strikes = gameState.strikes;

      const reParams: Record<string, number> = {};
      if (gameState.baseState != null) reParams.base_state = gameState.baseState;
      if (gameState.outs != null) reParams.outs = gameState.outs;

      const [pitchRes, reRes] = await Promise.all([
        getPitchPrediction(pitchParams),
        getRunExpectancy(reParams),
      ]);
      setPitchProbs(pitchRes.pitch_probabilities);
      setRunExp(reRes.expected_runs);
      setError(null);
    } catch {
      setError("Unable to load predictions.");
    } finally {
      setLoading(false);
    }
  }, [gameState.balls, gameState.strikes, gameState.baseState, gameState.outs]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  useEffect(() => {
    if (!ctx.isLive) return;
    intervalRef.current = setInterval(fetchPredictions, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ctx.isLive, fetchPredictions]);

  if (!ctx.isLive) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          &larr; All Tools
        </button>
        <div className="text-center text-sm text-neutral-500 py-8">
          Live predictions are available during games.
        </div>
      </div>
    );
  }

  const hasCountData = gameState.balls != null && gameState.strikes != null;
  const hasSituationData = gameState.outs != null || gameState.baseState != null;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        &larr; All Tools
      </button>

      <h3 className="text-section-header">What Happens Next</h3>

      {/* Current Game State */}
      <div className="card px-4 py-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Current State
          </span>
          <span className="text-xs text-neutral-600 tabular-nums">
            Auto-updating
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-300">
            {gameState.half != null
              ? `${formatHalf(gameState.half)} ${ordinal(gameState.inning)}`
              : ordinal(gameState.inning)}
          </span>
          <div className="flex gap-3 text-sm tabular-nums">
            <span className="text-neutral-400">
              {awayDisplay}{" "}
              <span className="text-neutral-200 font-semibold">
                {gameState.awayScore}
              </span>
            </span>
            <span className="text-neutral-400">
              {homeDisplay}{" "}
              <span className="text-neutral-200 font-semibold">
                {gameState.homeScore}
              </span>
            </span>
          </div>
        </div>

        {(hasSituationData || hasCountData) && (
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {gameState.baseState != null && (
              <span>{parseBaseStateLabel(gameState.baseState)}</span>
            )}
            {gameState.outs != null && (
              <span>
                {gameState.outs} out{gameState.outs !== 1 ? "s" : ""}
              </span>
            )}
            {hasCountData && (
              <span>
                Count {gameState.balls}-{gameState.strikes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Matchup Animation */}
      {pitchProbs && (
        <MatchupAnimation
          probabilities={pitchProbs}
          disabled={loading}
        />
      )}

      {loading && !pitchProbs && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-neutral-500 py-4">
          {error}
        </div>
      )}

      {!loading && !error && pitchProbs && (
        <>
          {/* Pitch Outcome Probabilities */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Next Pitch Outcome
            </h4>
            <div className="space-y-1.5">
              {Object.entries(pitchProbs)
                .sort(([, a], [, b]) => b - a)
                .map(([key, prob]) => (
                  <ProbabilityBar
                    key={key}
                    label={OUTCOME_LABELS[key as keyof typeof OUTCOME_LABELS] ?? key}
                    probability={prob}
                    color={OUTCOME_COLORS[key as keyof typeof OUTCOME_COLORS] ?? "#888"}
                    labelWidth="w-32"
                  />
                ))}
            </div>
          </div>

          {/* Run Expectancy */}
          {runExp != null && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                Run Expectancy
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-neutral-200 tabular-nums">
                  {runExp.toFixed(2)}
                </span>
                <span className="text-xs text-neutral-500">
                  expected runs this inning
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

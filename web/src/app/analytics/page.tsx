"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchTeams,
  runSimulation,
} from "@/features/analytics/services/SimulatorService";
import type {
  SimulatorTeam,
  SimulatorResult,
} from "@/features/analytics/types";
import { ProbabilityBar } from "@/features/analytics/components/ProbabilityBar";
import { ScoreCard } from "@/features/analytics/components/ScoreCard";
import { PABreakdown } from "@/features/analytics/components/PABreakdown";

const HOME_COLOR = "#1d4ed8";
const AWAY_COLOR = "#dc2626";

export default function AnalyticsPage() {
  const [teams, setTeams] = useState<SimulatorTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [homeAbbr, setHomeAbbr] = useState("");
  const [awayAbbr, setAwayAbbr] = useState("");
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const t = await fetchTeams();
        if (!cancelled) setTeams(t);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const canSimulate = homeAbbr && awayAbbr && homeAbbr !== awayAbbr && !loading;

  const handleSimulate = useCallback(async () => {
    if (!canSimulate) return;
    try {
      setLoading(true);
      setError(null);
      const data = await runSimulation(homeAbbr, awayAbbr);
      setResult(data);
    } catch {
      setError("Unable to run simulation. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [homeAbbr, awayAbbr, canSimulate]);

  const homeName =
    teams.find((t) => t.abbreviation === homeAbbr)?.short_name ??
    teams.find((t) => t.abbreviation === homeAbbr)?.name ??
    homeAbbr;
  const awayName =
    teams.find((t) => t.abbreviation === awayAbbr)?.short_name ??
    teams.find((t) => t.abbreviation === awayAbbr)?.name ??
    awayAbbr;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-50">
          MLB Matchup Simulator
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Monte Carlo simulation powered by real Statcast data.
        </p>
      </div>

      {/* Team Pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Away
          </label>
          <select
            value={awayAbbr}
            onChange={(e) => {
              setAwayAbbr(e.target.value);
              setResult(null);
            }}
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
          >
            <option value="">
              {teamsLoading ? "Loading..." : "Select team"}
            </option>
            {teams.map((t) => (
              <option key={t.abbreviation} value={t.abbreviation}>
                {t.name} ({t.abbreviation})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Home
          </label>
          <select
            value={homeAbbr}
            onChange={(e) => {
              setHomeAbbr(e.target.value);
              setResult(null);
            }}
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
          >
            <option value="">
              {teamsLoading ? "Loading..." : "Select team"}
            </option>
            {teams.map((t) => (
              <option key={t.abbreviation} value={t.abbreviation}>
                {t.name} ({t.abbreviation})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulate Button */}
      <button
        onClick={handleSimulate}
        disabled={!canSimulate}
        className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Simulating..." : "Run Simulation"}
      </button>

      {homeAbbr && awayAbbr && homeAbbr === awayAbbr && (
        <p className="text-xs text-amber-500 text-center">
          Select two different teams.
        </p>
      )}

      {error && (
        <div className="text-center text-sm text-neutral-500 py-6">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />
          <div className="h-5 bg-neutral-800 rounded animate-pulse" />
          <div className="h-5 bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse mt-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-neutral-800 rounded animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-5">
          {/* Win Probability */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Win Probability
            </h4>
            <div className="space-y-2">
              <ProbabilityBar
                label={awayName}
                probability={result.away_win_probability}
                color={AWAY_COLOR}
              />
              <ProbabilityBar
                label={homeName}
                probability={result.home_win_probability}
                color={HOME_COLOR}
              />
            </div>
            {result.model_home_win_probability != null && (
              <p className="text-[11px] text-neutral-600">
                ML model: {homeName}{" "}
                {Math.round(result.model_home_win_probability * 100)}%
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

          {/* Most Common Scores */}
          {result.most_common_scores.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Most Likely Final Scores
              </h4>
              <div className="space-y-2">
                {result.most_common_scores.map((s, i) => (
                  <ScoreCard
                    key={s.score}
                    rank={i + 1}
                    score={s.score}
                    probability={s.probability}
                    awayTeam={awayName}
                    homeTeam={homeName}
                    awayColor={AWAY_COLOR}
                    homeColor={HOME_COLOR}
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Metadata */}
          <div className="flex gap-4 text-[11px] text-neutral-600 pt-2 border-t border-neutral-800/50">
            <span>{result.iterations.toLocaleString()} iterations</span>
            <span>{result.rolling_window}-game window</span>
            {!result.profiles_loaded && (
              <span className="text-amber-600">Using league-average defaults</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

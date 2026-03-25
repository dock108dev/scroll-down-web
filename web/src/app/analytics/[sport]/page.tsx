"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import {
  fetchSimulatorTeams,
  runPublicSimulation,
} from "@/features/analytics/services/PublicSimulatorService";
import type { SimulatorTeam, SimulatorResult } from "@/features/analytics/types";
import { SimulatorResults } from "@/features/analytics/components/SimulatorResults";
import { AuthGate } from "@/components/auth/AuthGate";
import { trackEvent } from "@/lib/analytics";

const SPORT_CONFIG: Record<
  string,
  { label: string; title: string; description: string }
> = {
  nba: {
    label: "NBA",
    title: "NBA Simulator",
    description:
      "Possession-based Monte Carlo simulation powered by team performance profiles.",
  },
  nhl: {
    label: "NHL",
    title: "NHL Simulator",
    description:
      "Shot-level Monte Carlo simulation powered by team performance profiles.",
  },
  ncaab: {
    label: "NCAAB",
    title: "NCAAB Simulator",
    description:
      "Four-factor Monte Carlo simulation powered by team performance profiles.",
  },
};

const HOME_COLOR = "#1d4ed8";
const AWAY_COLOR = "#dc2626";

export default function SportSimulatorPage() {
  const { sport } = useParams<{ sport: string }>();
  const config = SPORT_CONFIG[sport];
  if (!config) notFound();

  const [teams, setTeams] = useState<SimulatorTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [homeAbbr, setHomeAbbr] = useState("");
  const [awayAbbr, setAwayAbbr] = useState("");
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load teams ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const t = await fetchSimulatorTeams(sport);
        if (!cancelled) setTeams(t);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sport]);

  // ─── Validation ──────────────────────────────────────────────

  const canSimulate =
    homeAbbr && awayAbbr && homeAbbr !== awayAbbr && !loading;

  // ─── Run simulation ─────────────────────────────────────────

  const handleSimulate = useCallback(async () => {
    if (!canSimulate) return;
    try {
      setLoading(true);
      setError(null);
      const data = await runPublicSimulation(sport, {
        home_team: homeAbbr,
        away_team: awayAbbr,
        iterations: 10000,
      });
      setResult(data);
      trackEvent("simulation_run", { sport, home: homeAbbr, away: awayAbbr });
    } catch {
      setError("Unable to run simulation. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [canSimulate, sport, homeAbbr, awayAbbr]);

  // ─── Display names ──────────────────────────────────────────

  const homeName = useMemo(
    () =>
      teams.find((t) => t.abbreviation === homeAbbr)?.short_name ??
      teams.find((t) => t.abbreviation === homeAbbr)?.name ??
      homeAbbr,
    [teams, homeAbbr],
  );
  const awayName = useMemo(
    () =>
      teams.find((t) => t.abbreviation === awayAbbr)?.short_name ??
      teams.find((t) => t.abbreviation === awayAbbr)?.name ??
      awayAbbr,
    [teams, awayAbbr],
  );

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-neutral-50">{config.title}</h1>
        <p className="text-xs text-neutral-500 mt-1">{config.description}</p>
      </div>

      <AuthGate
        minRole="user"
        message="Sign up for free to access the matchup simulator"
      >
        {/* ── Team Pickers ────────────────────────────────── */}
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

        {/* ── Simulate Button ─────────────────────────────── */}
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

        {/* ── Loading skeleton ────────────────────────────── */}
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

        {/* ── Results ─────────────────────────────────────── */}
        {!loading && result && (
          <SimulatorResults
            result={result}
            homeName={homeName}
            awayName={awayName}
            homeColor={HOME_COLOR}
            awayColor={AWAY_COLOR}
          />
        )}
      </AuthGate>
    </>
  );
}

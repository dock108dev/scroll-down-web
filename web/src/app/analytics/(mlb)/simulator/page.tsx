"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  fetchTeams,
  fetchRoster,
  runSimulation,
  dedupeTeams,
} from "@/features/analytics/services/SimulatorService";
import type {
  SimulatorTeam,
  SimulatorResult,
  RosterBatter,
  RosterPitcher,
  LineupSlot,
  PitcherSlot,
} from "@/features/analytics/types";
import { LineupBuilder } from "@/features/analytics/components/LineupBuilder";
import { SimulatorResults } from "@/features/analytics/components/SimulatorResults";
import { AuthGate } from "@/components/auth/AuthGate";

const HOME_COLOR = "#1d4ed8";
const AWAY_COLOR = "#dc2626";
const EMPTY_LINEUP: LineupSlot[] = Array.from({ length: 9 }, () => ({
  external_ref: "",
  name: "",
}));
function autoFillLineup(batters: RosterBatter[]): LineupSlot[] {
  return batters.slice(0, 9).map((b) => ({
    external_ref: b.external_ref,
    name: b.name,
  }));
}

function autoFillStarter(pitchers: RosterPitcher[]): PitcherSlot | null {
  const p = pitchers[0];
  return p ? { external_ref: p.external_ref, name: p.name, avg_ip: p.avg_ip } : null;
}



export default function MLBSimulatorPage() {
  // Teams
  const [teams, setTeams] = useState<SimulatorTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [homeAbbr, setHomeAbbr] = useState("");
  const [awayAbbr, setAwayAbbr] = useState("");

  // Rosters
  const [homeBatters, setHomeBatters] = useState<RosterBatter[]>([]);
  const [homePitchers, setHomePitchers] = useState<RosterPitcher[]>([]);
  const [awayBatters, setAwayBatters] = useState<RosterBatter[]>([]);
  const [awayPitchers, setAwayPitchers] = useState<RosterPitcher[]>([]);
  const [homeRosterLoading, setHomeRosterLoading] = useState(false);
  const [awayRosterLoading, setAwayRosterLoading] = useState(false);

  // Lineups
  const [homeLineup, setHomeLineup] = useState<LineupSlot[]>([...EMPTY_LINEUP]);
  const [awayLineup, setAwayLineup] = useState<LineupSlot[]>([...EMPTY_LINEUP]);
  const [homeStarter, setHomeStarter] = useState<PitcherSlot | null>(null);
  const [awayStarter, setAwayStarter] = useState<PitcherSlot | null>(null);

  // Results
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load teams ───────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const t = await fetchTeams();
        if (!cancelled) setTeams(dedupeTeams(t));
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
  }, []);

  // ─── Load rosters on team selection ───────────────────────

  useEffect(() => {
    if (!homeAbbr) {
      setHomeBatters([]);
      setHomePitchers([]);
      setHomeLineup([...EMPTY_LINEUP]);
      setHomeStarter(null);
      return;
    }
    let cancelled = false;
    setHomeBatters([]);
    setHomePitchers([]);
    setHomeLineup([...EMPTY_LINEUP]);
    setHomeStarter(null);
    setHomeRosterLoading(true);
    fetchRoster(homeAbbr)
      .then((r) => {
        if (cancelled) return;
        setHomeBatters(r.batters);
        setHomePitchers(r.pitchers);
        setHomeLineup(
          r.batters.length >= 9 ? autoFillLineup(r.batters) : [...EMPTY_LINEUP],
        );
        setHomeStarter(autoFillStarter(r.pitchers));
      })
      .catch(() => {
        if (!cancelled) {
          setHomeBatters([]);
          setHomePitchers([]);
          setHomeLineup([...EMPTY_LINEUP]);
          setHomeStarter(null);
        }
      })
      .finally(() => {
        if (!cancelled) setHomeRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeAbbr]);

  useEffect(() => {
    if (!awayAbbr) {
      setAwayBatters([]);
      setAwayPitchers([]);
      setAwayLineup([...EMPTY_LINEUP]);
      setAwayStarter(null);
      return;
    }
    let cancelled = false;
    setAwayBatters([]);
    setAwayPitchers([]);
    setAwayLineup([...EMPTY_LINEUP]);
    setAwayStarter(null);
    setAwayRosterLoading(true);
    fetchRoster(awayAbbr)
      .then((r) => {
        if (cancelled) return;
        setAwayBatters(r.batters);
        setAwayPitchers(r.pitchers);
        setAwayLineup(
          r.batters.length >= 9 ? autoFillLineup(r.batters) : [...EMPTY_LINEUP],
        );
        setAwayStarter(autoFillStarter(r.pitchers));
      })
      .catch(() => {
        if (!cancelled) {
          setAwayBatters([]);
          setAwayPitchers([]);
          setAwayLineup([...EMPTY_LINEUP]);
          setAwayStarter(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAwayRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [awayAbbr]);

  // ─── Validation ───────────────────────────────────────────

  const homeLineupFilled = homeLineup.filter((s) => s.external_ref).length;
  const awayLineupFilled = awayLineup.filter((s) => s.external_ref).length;

  const canSimulate =
    homeAbbr &&
    awayAbbr &&
    homeAbbr !== awayAbbr &&
    homeLineupFilled === 9 &&
    awayLineupFilled === 9 &&
    homeStarter !== null &&
    awayStarter !== null &&
    !homeRosterLoading &&
    !awayRosterLoading &&
    !loading;

  // ─── Run simulation ──────────────────────────────────────

  const handleSimulate = useCallback(async () => {
    if (!canSimulate) return;
    try {
      setLoading(true);
      setError(null);
      const data = await runSimulation({
        sport: "mlb",
        home_team: homeAbbr,
        away_team: awayAbbr,
        iterations: 10000,
        probability_mode: "ml",
        home_lineup: homeLineup,
        away_lineup: awayLineup,
        home_starter: homeStarter!,
        away_starter: awayStarter!,
        starter_innings: 6,
        exclude_playoffs: true,
      });
      setResult(data);
    } catch {
      setError("Unable to run simulation. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [
    canSimulate,
    homeAbbr,
    awayAbbr,
    homeLineup,
    awayLineup,
    homeStarter,
    awayStarter,
  ]);

  // ─── Derived display names ────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-neutral-50">
          MLB PA Simulator
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Lineup-aware Monte Carlo simulation powered by Statcast plate
          appearance data.
        </p>
      </div>

      <AuthGate
        minRole="user"
        message="Sign up for free to access the matchup simulator"
      >
        {/* ── Team Pickers ──────────────────────────────── */}
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

        {/* ── Lineup Builders ───────────────────────────── */}
        {(awayAbbr || homeAbbr) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {awayAbbr && (
              <LineupBuilder
                label={`${awayName} Lineup`}
                batters={awayBatters}
                pitchers={awayPitchers}
                lineup={awayLineup}
                starter={awayStarter}
                onLineupChange={setAwayLineup}
                onStarterChange={setAwayStarter}
                loading={awayRosterLoading}
              />
            )}
            {homeAbbr && (
              <LineupBuilder
                label={`${homeName} Lineup`}
                batters={homeBatters}
                pitchers={homePitchers}
                lineup={homeLineup}
                starter={homeStarter}
                onLineupChange={setHomeLineup}
                onStarterChange={setHomeStarter}
                loading={homeRosterLoading}
              />
            )}
          </div>
        )}

        {/* ── Simulate Button ───────────────────────────── */}
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

        {/* Lineup completeness hint */}
        {homeAbbr &&
          awayAbbr &&
          homeAbbr !== awayAbbr &&
          (homeLineupFilled < 9 || awayLineupFilled < 9 || !homeStarter || !awayStarter) && (
            <p className="text-xs text-neutral-600 text-center">
              Fill both 9-man lineups and select starting pitchers to simulate.
            </p>
          )}

        {error && (
          <div className="text-center text-sm text-neutral-500 py-6">
            {error}
          </div>
        )}

        {/* ── Loading skeleton ──────────────────────────── */}
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

        {/* ── Results ───────────────────────────────────── */}
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

"use client";

import { useEffect, useState, useMemo } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { fetchTeams, dedupeTeams } from "@/features/analytics/services/SimulatorService";
import {
  fetchTeamProfile,
  fetchDataCoverage,
} from "@/features/analytics/services/ProfilesService";
import type {
  SimulatorTeam,
  TeamProfile,
  DataCoverage,
} from "@/features/analytics/types";

const WINDOWS = [7, 14, 30, 60] as const;

function MetricRow({ label, value, baseline }: { label: string; value: number; baseline?: number }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-neutral-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-neutral-200 font-medium">{value.toFixed(3)}</span>
        {baseline !== undefined && (
          <span className="text-neutral-600">
            (lg avg: {baseline.toFixed(3)})
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProfilesPage() {
  const [teams, setTeams] = useState<SimulatorTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [window, setWindow] = useState<number>(30);
  const [profiles, setProfiles] = useState<Record<string, TeamProfile>>({});
  const [profilesLoading, setProfilesLoading] = useState<Record<string, boolean>>({});
  const [coverage, setCoverage] = useState<DataCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load teams
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const t = await fetchTeams();
        if (!cancelled) setTeams(dedupeTeams(t));
      } catch { /* ignore */ }
      finally { if (!cancelled) setTeamsLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load data coverage
  useEffect(() => {
    let cancelled = false;
    fetchDataCoverage()
      .then((c) => { if (!cancelled) setCoverage(c); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  // Load profiles when teams or window changes
  useEffect(() => {
    if (selectedTeams.length === 0) return;
    let cancelled = false;

    for (const abbr of selectedTeams) {
      const key = `${abbr}-${window}`;
      if (profiles[key]) continue;

      setProfilesLoading((prev) => ({ ...prev, [key]: true }));
      fetchTeamProfile(abbr, window)
        .then((p) => {
          if (!cancelled) {
            setProfiles((prev) => ({ ...prev, [key]: p }));
          }
        })
        .catch(() => {
          if (!cancelled) setError(`Failed to load profile for ${abbr}.`);
        })
        .finally(() => {
          if (!cancelled) setProfilesLoading((prev) => ({ ...prev, [key]: false }));
        });
    }

    return () => { cancelled = true; };
  }, [selectedTeams, window, profiles]);

  const handleAddTeam = (abbr: string) => {
    if (!abbr || selectedTeams.includes(abbr)) return;
    setSelectedTeams((prev) => [...prev, abbr]);
  };

  const handleRemoveTeam = (abbr: string) => {
    setSelectedTeams((prev) => prev.filter((t) => t !== abbr));
  };

  const profileCards = useMemo(
    () => selectedTeams.map((abbr) => ({
      abbr,
      team: teams.find((t) => t.abbreviation === abbr),
      profile: profiles[`${abbr}-${window}`],
      loading: profilesLoading[`${abbr}-${window}`] ?? false,
    })),
    [selectedTeams, teams, profiles, profilesLoading, window],
  );

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-neutral-50">Team Profiles</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Rolling team performance metrics with league baselines.
        </p>
      </div>

      <AuthGate minRole="user" message="Sign up for free to access team profiles">
        <div className="space-y-5">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Controls ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Add Team
              </label>
              <select
                value=""
                onChange={(e) => handleAddTeam(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
              >
                <option value="">
                  {teamsLoading ? "Loading..." : "Select team"}
                </option>
                {teams
                  .filter((t) => !selectedTeams.includes(t.abbreviation))
                  .map((t) => (
                    <option key={t.abbreviation} value={t.abbreviation}>
                      {t.name} ({t.abbreviation})
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Rolling Window
              </label>
              <select
                value={window}
                onChange={(e) => setWindow(Number(e.target.value))}
                className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
              >
                {WINDOWS.map((w) => (
                  <option key={w} value={w}>{w} days</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Selected Teams Tags ────────────────────── */}
          {selectedTeams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTeams.map((abbr) => (
                <button
                  key={abbr}
                  onClick={() => handleRemoveTeam(abbr)}
                  className="text-xs px-2 py-1 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
                >
                  {abbr} ×
                </button>
              ))}
            </div>
          )}

          {/* ── Profile Cards ──────────────────────────── */}
          {selectedTeams.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">
              Select a team to view its profile.
            </p>
          ) : (
            <div className={`grid gap-4 ${profileCards.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {profileCards.map(({ abbr, team, profile, loading: pLoading }) => (
                <div
                  key={abbr}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4"
                >
                  <h3 className="text-sm font-semibold text-neutral-200 mb-3">
                    {team?.name ?? abbr}
                  </h3>
                  {pLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-4 bg-neutral-800 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : !profile ? (
                    <p className="text-xs text-neutral-500">No profile data available.</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(profile.metrics).map(([key, val]) => (
                        <MetricRow
                          key={key}
                          label={key.replace(/_/g, " ")}
                          value={val}
                          baseline={profile.baselines?.[key]}
                        />
                      ))}
                      <div className="mt-2 pt-2 border-t border-neutral-800 text-xs text-neutral-500">
                        {profile.games_used} games used
                        {profile.date_range && (
                          <span className="ml-2">({profile.date_range[0]} – {profile.date_range[1]})</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Data Coverage ──────────────────────────── */}
          {coverage && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
                Data Coverage
              </h2>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-500">PA Data</span>
                    <div className={`font-medium ${coverage.advanced_data_coverage.pa ? "text-green-400" : "text-neutral-500"}`}>
                      {coverage.advanced_data_coverage.pa ? "Ready" : "Missing"}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Pitch Data</span>
                    <div className={`font-medium ${coverage.advanced_data_coverage.pitch ? "text-green-400" : "text-neutral-500"}`}>
                      {coverage.advanced_data_coverage.pitch ? "Ready" : "Missing"}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Fielding Data</span>
                    <div className={`font-medium ${coverage.advanced_data_coverage.fielding ? "text-green-400" : "text-neutral-500"}`}>
                      {coverage.advanced_data_coverage.fielding ? "Ready" : "Missing"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-500">Player Advanced Stats</span>
                    <div className="text-neutral-200 font-medium">{coverage.counts.player_advanced_stats.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Pitcher Game Stats</span>
                    <div className="text-neutral-200 font-medium">{coverage.counts.pitcher_game_stats.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Team Advanced Stats</span>
                    <div className="text-neutral-200 font-medium">{coverage.counts.team_advanced_stats.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Fielding Stats</span>
                    <div className="text-neutral-200 font-medium">{coverage.counts.fielding_stats.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </AuthGate>
    </>
  );
}

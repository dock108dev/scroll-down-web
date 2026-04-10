"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { fetchForecasts } from "@/features/analytics/services/ForecastsService";
import type { Forecast, ForecastsResponse } from "@/features/analytics/types";

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtScore(v: number): string {
  return v.toFixed(1);
}

function fmtLine(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}

function ForecastCard({ f }: { f: Forecast }) {
  const [expanded, setExpanded] = useState(false);
  const favorite =
    f.home_win_prob >= f.away_win_prob ? "home" : "away";

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 text-left transition-colors hover:border-neutral-700"
    >
      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-sm text-neutral-200 font-medium truncate">
            {f.away_team}
            <span className="text-neutral-600 mx-1.5">@</span>
            {f.home_team}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-neutral-100 tabular-nums">
              {fmtPct(favorite === "home" ? f.home_win_prob : f.away_win_prob)}
            </div>
            <div className="text-[10px] text-neutral-500">
              {favorite === "home" ? f.home_team : f.away_team} favored
            </div>
          </div>
          <span className="text-neutral-600 text-xs">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-neutral-800 space-y-3">
          {/* Win probabilities */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                {f.away_team}
              </div>
              <div className="text-lg font-bold text-neutral-100 tabular-nums">
                {fmtPct(f.away_win_prob)}
              </div>
              <div className="text-xs text-neutral-400 tabular-nums">
                {fmtScore(f.predicted_away_score)} runs
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                {f.home_team}
              </div>
              <div className="text-lg font-bold text-neutral-100 tabular-nums">
                {fmtPct(f.home_win_prob)}
              </div>
              <div className="text-xs text-neutral-400 tabular-nums">
                {fmtScore(f.predicted_home_score)} runs
              </div>
            </div>
          </div>

          {/* Probability bar */}
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden flex">
            <div
              className="bg-red-600 transition-all"
              style={{ width: `${f.away_win_prob * 100}%` }}
            />
            <div
              className="bg-blue-600 transition-all"
              style={{ width: `${f.home_win_prob * 100}%` }}
            />
          </div>

          {/* Line analysis */}
          {f.line_analysis && (
            <div className="rounded-lg bg-neutral-950 px-3 py-2.5 space-y-2">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
                Market Lines
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.away_team}</span>
                  <span className="text-neutral-300 tabular-nums">
                    {fmtLine(f.line_analysis.market_away_ml)}
                    <span className="text-neutral-500 ml-1.5">
                      ({fmtPct(f.line_analysis.market_away_wp)})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.home_team}</span>
                  <span className="text-neutral-300 tabular-nums">
                    {fmtLine(f.line_analysis.market_home_ml)}
                    <span className="text-neutral-500 ml-1.5">
                      ({fmtPct(f.line_analysis.market_home_wp)})
                    </span>
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-neutral-600 pt-1">
                via {f.line_analysis.provider}
              </div>
            </div>
          )}

          {!f.line_analysis && (
            <p className="text-xs text-neutral-600">
              No market odds available for this game.
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export default function ForecastsPage() {
  const [data, setData] = useState<ForecastsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchForecasts();
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setError("Failed to load forecasts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-neutral-50">
          Today&apos;s MLB Forecasts
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Pre-computed predictions refreshed hourly.
        </p>
      </div>

      <AuthGate
        minRole="user"
        message={<div className="space-y-3"><p className="font-medium">Sign up for free to view today&apos;s MLB predictions</p><ul className="text-xs text-neutral-400 space-y-1 text-left"><li>Win probabilities for every game on the schedule</li><li>Market edge analysis vs. sportsbook lines</li><li>Expected scores, run lines, and over/under estimates</li></ul></div>}

      >
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-neutral-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && data && data.forecasts.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-neutral-400">No forecasts available.</p>
            <p className="text-xs text-neutral-600">
              Check back when MLB games are scheduled.
            </p>
          </div>
        )}

        {!loading && data && data.forecasts.length > 0 && (
          <div className="space-y-2">
            {data.forecasts.map((f) => (
              <ForecastCard key={f.game_id} f={f} />
            ))}
          </div>
        )}

        {!loading && data && data.last_refreshed && (
          <p className="text-[10px] text-neutral-600 pt-2">
            Last updated{" "}
            {new Date(data.last_refreshed).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </AuthGate>
    </>
  );
}

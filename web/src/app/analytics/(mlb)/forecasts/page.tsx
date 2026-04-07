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

function edgeColor(edge: number): string {
  if (edge >= 0.05) return "text-green-400";
  if (edge >= 0.02) return "text-green-500/80";
  if (edge <= -0.05) return "text-red-400";
  if (edge <= -0.02) return "text-red-500/80";
  return "text-neutral-400";
}

function evColor(ev: number): string {
  if (ev >= 5) return "text-green-400";
  if (ev >= 2) return "text-green-500/80";
  if (ev <= -5) return "text-red-400";
  if (ev <= -2) return "text-red-500/80";
  return "text-neutral-400";
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
          {f.line_analysis && (
            <div className="text-right">
              <div
                className={`text-xs font-medium tabular-nums ${evColor(
                  Math.max(
                    f.line_analysis.home_ev_pct,
                    f.line_analysis.away_ev_pct,
                  ),
                )}`}
              >
                {Math.max(
                  f.line_analysis.home_ev_pct,
                  f.line_analysis.away_ev_pct,
                ) > 0
                  ? `+${Math.max(f.line_analysis.home_ev_pct, f.line_analysis.away_ev_pct).toFixed(1)}% EV`
                  : "No edge"}
              </div>
              <div className="text-[10px] text-neutral-600">
                {f.line_analysis.provider}
              </div>
            </div>
          )}
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
                Market Comparison
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Market</span>
                  <span className="text-neutral-300 tabular-nums">
                    {fmtLine(f.line_analysis.market_away_ml)} /{" "}
                    {fmtLine(f.line_analysis.market_home_ml)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Model fair</span>
                  <span className="text-neutral-300 tabular-nums">
                    {fmtLine(f.line_analysis.model_away_line)} /{" "}
                    {fmtLine(f.line_analysis.model_home_line)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.away_team} edge</span>
                  <span
                    className={`font-medium tabular-nums ${edgeColor(
                      f.line_analysis.away_edge,
                    )}`}
                  >
                    {(f.line_analysis.away_edge * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.home_team} edge</span>
                  <span
                    className={`font-medium tabular-nums ${edgeColor(
                      f.line_analysis.home_edge,
                    )}`}
                  >
                    {(f.line_analysis.home_edge * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.away_team} EV</span>
                  <span
                    className={`font-medium tabular-nums ${evColor(
                      f.line_analysis.away_ev_pct,
                    )}`}
                  >
                    {f.line_analysis.away_ev_pct > 0 ? "+" : ""}
                    {f.line_analysis.away_ev_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{f.home_team} EV</span>
                  <span
                    className={`font-medium tabular-nums ${evColor(
                      f.line_analysis.home_ev_pct,
                    )}`}
                  >
                    {f.line_analysis.home_ev_pct > 0 ? "+" : ""}
                    {f.line_analysis.home_ev_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {!f.line_analysis && (
            <p className="text-xs text-neutral-600">
              No market odds available for this game.
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-[10px] text-neutral-600">
            <span>{f.sim_meta.iterations.toLocaleString()} sims</span>
            <span>Source: {f.probability_source.replace(/_/g, " ")}</span>
            {f.sim_meta.model_id && (
              <span>Model: {f.sim_meta.model_id}</span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

export default function ForecastsPage() {
  const [data, setData] = useState<ForecastsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edgeFilter, setEdgeFilter] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchForecasts({
          minEdge: edgeFilter ?? undefined,
        });
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
  }, [edgeFilter]);

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-neutral-50">
          Today&apos;s MLB Forecasts
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Pre-computed predictions refreshed hourly with market line analysis.
        </p>
      </div>

      <AuthGate
        minRole="user"
        message="Sign up for free to view today's MLB predictions and market edge analysis"
      >
        {/* Edge filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Min edge:</span>
          <div className="flex gap-1">
            {[null, 0.02, 0.03, 0.05].map((v) => (
              <button
                key={v ?? "all"}
                onClick={() => setEdgeFilter(v)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  edgeFilter === v
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                }`}
              >
                {v == null ? "All" : `${(v * 100).toFixed(0)}%+`}
              </button>
            ))}
          </div>
        </div>

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
              {edgeFilter
                ? "Try lowering the edge filter, or check back when games are scheduled."
                : "Check back when MLB games are scheduled."}
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

        {!loading && data && (
          <div className="flex flex-wrap gap-4 text-[10px] text-neutral-600 pt-2 border-t border-neutral-800/50">
            <span>{data.count} game{data.count !== 1 ? "s" : ""}</span>
            <span>Date: {data.date}</span>
            {data.last_refreshed && (
              <span>
                Refreshed:{" "}
                {new Date(data.last_refreshed).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}
      </AuthGate>
    </>
  );
}

"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { APIBet } from "@/lib/types";
import type { SimulatorResult } from "@/features/analytics/types";
import { runPublicSimulation } from "@/features/analytics/services/PublicSimulatorService";
import { FAIRBET } from "@/lib/config";
import { FairBetTheme } from "@/lib/theme";

// ── Simulation state machine ─────────────────────────────────────────
type SimState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: SimulatorResult }
  | { status: "error"; message: string };

type SimAction =
  | { type: "start" }
  | { type: "success"; result: SimulatorResult }
  | { type: "fail"; message: string };

function simReducer(_: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "start":
      return { status: "loading" };
    case "success":
      return { status: "done", result: action.result };
    case "fail":
      return { status: "error", message: action.message };
  }
}

// Per-sport score std dev used to estimate spread cover % and over/under %
const SCORE_STDDEV: Record<string, number> = {
  mlb: 2.5,
  nba: 10,
  nfl: 9,
  nhl: 1.5,
  ncaab: 9,
  ncaaf: 11,
};

// Abramowitz & Stegun approximation (max error < 1.5e-7)
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCDF(x: number, mean: number, std: number): number {
  return 0.5 * (1 + erf((x - mean) / (std * Math.SQRT2)));
}

/** P(margin > threshold) for home team */
function pCover(threshold: number, meanMargin: number, std: number): number {
  return 1 - normalCDF(threshold, meanMargin, std);
}

/** P(total > line) */
function pOver(line: number, meanTotal: number, std: number): number {
  return 1 - normalCDF(line, meanTotal, std);
}

const MARGIN_BUCKETS: Array<{ min: number; max: number; label: string }> = [
  { min: -Infinity, max: -10, label: "≤-10" },
  { min: -9, max: -7, label: "-7~9" },
  { min: -6, max: -4, label: "-4~6" },
  { min: -3, max: -2, label: "-2~3" },
  { min: -1, max: 0, label: "-1,0" },
  { min: 1, max: 2, label: "+1,2" },
  { min: 3, max: 4, label: "+3,4" },
  { min: 5, max: 7, label: "+5~7" },
  { min: 8, max: 9, label: "+8,9" },
  { min: 10, max: Infinity, label: "≥+10" },
];

interface MarginBucket {
  label: string;
  prob: number;
}

function buildMarginBuckets(
  scores: Array<{ score: string; probability: number }>,
): MarginBucket[] {
  const buckets = MARGIN_BUCKETS.map((b) => ({ label: b.label, prob: 0 }));

  for (const s of scores) {
    const parts = s.score.split("-");
    if (parts.length !== 2) continue;
    const home = parseInt(parts[0], 10);
    const away = parseInt(parts[1], 10);
    if (isNaN(home) || isNaN(away)) continue;
    const margin = home - away;

    for (let i = 0; i < MARGIN_BUCKETS.length; i++) {
      if (margin >= MARGIN_BUCKETS[i].min && margin <= MARGIN_BUCKETS[i].max) {
        buckets[i].prob += s.probability;
        break;
      }
    }
  }

  return buckets;
}

function scheduleIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(fn);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 0);
  return () => clearTimeout(id);
}

interface MonteCarloSheetProps {
  open: boolean;
  onClose: () => void;
  bet: APIBet;
}

export function MonteCarloSheet({ open, onClose, bet }: MonteCarloSheetProps) {
  const [sim, dispatch] = useReducer(simReducer, { status: "idle" });
  const sheetRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sport = bet.league_code.toLowerCase();
  const isSpreadBet = /spread/i.test(bet.market_key);
  const isTotalBet = /total/i.test(bet.market_key);
  const spreadLine =
    isSpreadBet && bet.line_value != null ? bet.line_value : null;
  const totalLine =
    isTotalBet && bet.line_value != null ? bet.line_value : null;

  const homeTeam = bet.home_team;
  const awayTeam = bet.away_team;

  useEffect(() => {
    if (!open) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      dispatch({ type: "start" });
      if (controller.signal.aborted) return;
      try {
        const res = await runPublicSimulation(sport, {
          home_team: homeTeam,
          away_team: awayTeam,
          iterations: FAIRBET.MONTE_CARLO_TRIALS,
        });
        if (!controller.signal.aborted) {
          dispatch({ type: "success", result: res });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          dispatch({
            type: "fail",
            message: err instanceof Error ? err.message : "Simulation failed",
          });
        }
      }
    };

    const cancel = scheduleIdle(run);
    return () => {
      controller.abort();
      cancel();
    };
  }, [open, sport, homeTeam, awayTeam]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

  const result = sim.status === "done" ? sim.result : null;
  const loading = sim.status === "loading";
  const error = sim.status === "error" ? sim.message : null;

  const marginBuckets = result?.most_common_scores
    ? buildMarginBuckets(result.most_common_scores)
    : [];
  const maxBucketProb = marginBuckets.reduce(
    (m, b) => Math.max(m, b.prob),
    0,
  );

  const std = SCORE_STDDEV[sport] ?? 10;
  const meanMargin = result
    ? result.average_home_score - result.average_away_score
    : 0;
  // Combined margin std dev ≈ sqrt(2) × per-team std dev
  const marginStd = std * Math.SQRT2;

  // Spread cover: home covers if margin > threshold
  // spreadLine = -3 (home favored) → threshold = 3; spreadLine = +3 (underdog) → threshold = -3
  const coverThreshold = spreadLine != null ? -spreadLine : 0;
  const coverPct = result ? pCover(coverThreshold, meanMargin, marginStd) : null;

  // Over %: only shown when a total line is available from the bet
  const overPct =
    result && totalLine != null
      ? pOver(totalLine, result.average_total, std * 2)
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Win Probability Simulator"
        data-testid="montecarlo-sheet"
        className="
          fixed z-50 flex flex-col gap-4
          bottom-0 left-0 right-0
          md:bottom-auto md:left-1/2 md:top-1/2
          md:-translate-x-1/2 md:-translate-y-1/2
          md:w-full md:max-w-md
          border rounded-t-2xl md:rounded-2xl
          shadow-2xl p-5
        "
        style={{
          background: "var(--color-neutral-900, #171717)",
          borderColor: "var(--color-neutral-800, #262626)",
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-neutral-400, #a3a3a3)" }}
            >
              Win Probability · {FAIRBET.MONTE_CARLO_TRIALS.toLocaleString()} sims
            </p>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--color-neutral-50, #fafafa)" }}
            >
              {awayTeam} @ {homeTeam}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close simulator"
            className="shrink-0 rounded-lg flex items-center justify-center"
            style={{
              minHeight: "44px",
              minWidth: "44px",
              color: "var(--color-neutral-500, #737373)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span
              className="text-sm"
              style={{ color: "var(--color-neutral-400, #a3a3a3)" }}
            >
              Running simulations…
            </span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "rgb(248,113,113)",
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Win % bars */}
            <div
              className="rounded-xl p-3 space-y-2.5"
              style={{
                background: "var(--fb-surface-tint, rgba(255,255,255,0.04))",
                border: "1px solid var(--fb-border-subtle, rgba(255,255,255,0.08))",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Win Probability
              </p>
              <WinBar
                label={awayTeam}
                pct={result.away_win_probability}
                color={FairBetTheme.info}
                testId="montecarlo-away-win"
              />
              <WinBar
                label={homeTeam}
                pct={result.home_win_probability}
                color={FairBetTheme.positive}
                testId="montecarlo-home-win"
              />
            </div>

            {/* Cover % + Over/Under */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox
                label={
                  spreadLine != null
                    ? `Cover ${spreadLine > 0 ? "+" : ""}${spreadLine}`
                    : "Home cover pk"
                }
                value={
                  coverPct != null
                    ? `${(coverPct * 100).toFixed(1)}%`
                    : "—"
                }
                testId="montecarlo-cover-pct"
              />
              <StatBox
                label={
                  totalLine != null ? `Over ${totalLine}` : "Avg total"
                }
                value={
                  totalLine != null && overPct != null
                    ? `${(overPct * 100).toFixed(1)}%`
                    : result.average_total.toFixed(1)
                }
                testId="montecarlo-over-pct"
              />
            </div>

            {/* Margin-of-victory histogram */}
            {marginBuckets.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Margin of Victory
                </p>
                <p className="text-[9px] text-neutral-600">
                  ← Away · Home →
                </p>
                <div
                  className="flex items-end gap-0.5"
                  style={{ height: "56px" }}
                  data-testid="montecarlo-histogram"
                >
                  {marginBuckets.map((b, i) => {
                    const heightPct =
                      maxBucketProb > 0
                        ? (b.prob / maxBucketProb) * 100
                        : 0;
                    const isHome = i >= 5;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-0.5"
                        title={`${b.label}: ${(b.prob * 100).toFixed(1)}%`}
                      >
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full rounded-t-sm"
                            style={{
                              height: `${Math.max(heightPct, b.prob > 0 ? 4 : 0)}%`,
                              backgroundColor: isHome
                                ? FairBetTheme.positive
                                : FairBetTheme.info,
                              opacity: b.prob === 0 ? 0.12 : 0.85,
                            }}
                          />
                        </div>
                        <span
                          className="text-neutral-600 leading-none"
                          style={{ fontSize: "6px" }}
                        >
                          {b.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[9px] text-neutral-600">
              {result.iterations.toLocaleString()} simulations · estimates
              only
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function WinBar({
  label,
  pct,
  color,
  testId,
}: {
  label: string;
  pct: number;
  color: string;
  testId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-neutral-400 truncate">{label}</span>
        <span
          data-testid={testId}
          className="text-sm font-bold shrink-0"
          style={{ color }}
        >
          {(pct * 100).toFixed(1)}%
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background: "var(--fb-border-subtle, rgba(255,255,255,0.08))",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 space-y-0.5"
      style={{
        background: "var(--fb-surface-tint, rgba(255,255,255,0.04))",
        border: "1px solid var(--fb-border-subtle, rgba(255,255,255,0.08))",
      }}
    >
      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        data-testid={testId}
        className="text-base font-bold"
        style={{ color: "var(--color-neutral-50, #fafafa)" }}
      >
        {value}
      </p>
    </div>
  );
}

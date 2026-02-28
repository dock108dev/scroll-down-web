"use client";

import { useState } from "react";
import type { APIBet } from "@/lib/types";
import { formatOdds } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { FairBetTheme } from "@/lib/theme";
import { LeagueBadge } from "./LeagueBadge";
import {
  formatProbability,
  formatEV,
  getConfidenceColor,
  getConfidenceLabel,
  getEVColor,
  betId,
  probToDecimal,
  evPct,
} from "@/lib/fairbet-utils";

interface ParlaySheetProps {
  open: boolean;
  onClose: () => void;
  parlayBets: APIBet[];
  parlayOdds: number;
  parlayProbability: number;
  parlayConfidence: string;
  parlayCorrelated: boolean;
  onRemoveLeg: (id: string) => void;
  onClearAll: () => void;
}

export function ParlaySheet({
  open,
  onClose,
  parlayBets,
  parlayOdds,
  parlayProbability,
  parlayConfidence,
  parlayCorrelated,
  onRemoveLeg,
  onClearAll,
}: ParlaySheetProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const [bookOddsInput, setBookOddsInput] = useState("");

  if (!open) return null;

  const legCount = parlayBets.length;
  const hasFairData = parlayProbability > 0 && parlayOdds !== 0;

  // Decimal odds for display
  const fairDecimal = hasFairData ? probToDecimal(parlayProbability) : 0;

  // EV from user-entered book odds
  const parsedBookOdds = bookOddsInput.trim() ? Number(bookOddsInput) : NaN;
  const computedEV =
    hasFairData && Number.isFinite(parsedBookOdds) && parsedBookOdds !== 0
      ? evPct(parlayProbability, parsedBookOdds)
      : NaN;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5 space-y-5"
        style={{
          backgroundColor: "var(--fb-card-bg)",
          border: "1px solid var(--fb-border-subtle)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-50">Parlay Builder</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-50 text-sm px-2 py-1"
          >
            Close
          </button>
        </div>

        {/* Combined result card */}
        {legCount >= 2 && (
          <div
            className="rounded-xl p-4 space-y-3 text-center"
            style={{
              backgroundColor: "var(--fb-surface-tint)",
              border: `1px solid ${FairBetTheme.info}30`,
            }}
          >
            {/* Title row + info icon */}
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: FairBetTheme.info }}>
                {legCount} Leg Parlay
              </div>
              {/* Info tooltip — top right */}
              <div className="absolute top-0 right-0 group">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-neutral-600 text-[9px] text-neutral-500 cursor-help">
                  ?
                </span>
                <div className="pointer-events-none absolute top-full right-0 mt-1.5 w-56 rounded-lg bg-neutral-700 px-3 py-2 text-[10px] leading-relaxed text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-20 text-left">
                  These are fair odds computed from each leg&apos;s fair probability. To calculate EV%, compare against a sportsbook&apos;s offered parlay price.
                </div>
              </div>
            </div>

            {/* Fair Odds (large) */}
            <div>
              <div className="text-2xl font-bold text-neutral-50">
                {hasFairData
                  ? formatOdds(parlayOdds, oddsFormat)
                  : "---"}
              </div>
              {hasFairData && (
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {fairDecimal.toFixed(3)} decimal
                </div>
              )}
            </div>

            {/* Stats row: Fair Prob + Confidence */}
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-[10px] text-neutral-500">
                  Fair Probability
                </div>
                <div className="text-sm font-semibold text-neutral-50">
                  {hasFairData ? formatProbability(parlayProbability) : "N/A"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-neutral-500">
                  Confidence
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: getConfidenceColor(parlayConfidence) }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: getConfidenceColor(parlayConfidence) }}
                  >
                    {getConfidenceLabel(parlayConfidence)}
                  </span>
                </div>
              </div>
            </div>

            {/* Correlation warning */}
            {parlayCorrelated && (
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px]"
                style={{
                  backgroundColor: "rgba(234, 179, 8, 0.08)",
                  border: "1px solid rgba(234, 179, 8, 0.20)",
                  color: "rgb(234, 179, 8)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Assumes independence — SGP correlation not priced
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {legCount < 2 && (
          <div className="py-8 text-center text-sm text-neutral-500">
            {legCount === 0
              ? "Add bets from the list to build a parlay."
              : "Add at least one more leg to see parlay odds."}
          </div>
        )}

        {/* Leg list */}
        {legCount > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Legs
            </h3>
            {parlayBets.map((bet) => {
              const id = betId(bet);
              return (
                <div
                  key={id}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: "var(--fb-surface-tint)",
                    border: "1px solid var(--fb-card-border)",
                  }}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <LeagueBadge league={bet.league_code} />
                      <span className="text-xs font-semibold text-neutral-50 truncate">
                        {bet.selectionDisplay ?? bet.selection_key}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {bet.away_team} @ {bet.home_team}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {bet.reference_price != null && (
                        <span className="text-neutral-400">
                          Fair: {formatOdds(bet.reference_price, oddsFormat)}
                        </span>
                      )}
                      {bet.true_prob != null && (
                        <span className="text-neutral-500">
                          {formatProbability(bet.true_prob)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveLeg(id)}
                    className="shrink-0 mt-1 p-1 rounded-md hover:bg-red-500/20 transition"
                    title="Remove leg"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      style={{ color: FairBetTheme.negative }}
                    >
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline EV calculator */}
        {legCount >= 2 && hasFairData && (
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[11px] text-neutral-500">
              Enter your book&apos;s odds
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="+450"
              value={bookOddsInput}
              onChange={(e) => setBookOddsInput(e.target.value)}
              className="w-20 rounded-md px-2 py-1 text-xs text-neutral-50 bg-neutral-800 border border-neutral-700 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            <span className="text-[11px] text-neutral-600">&rarr;</span>
            {Number.isFinite(computedEV) ? (
              <span
                className="text-xs font-semibold"
                style={{ color: getEVColor(computedEV) }}
              >
                {formatEV(computedEV)} EV
              </span>
            ) : (
              <span className="text-[11px] text-neutral-600">
                enter American odds
              </span>
            )}
          </div>
        )}

        {/* Disclaimer */}
        {legCount >= 2 && (
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Fair odds computed from per-leg fair probabilities assuming independence.
            {parlayCorrelated
              ? " Same-game legs may have correlated outcomes — actual fair probability may differ."
              : " This is for informational purposes only."}
          </p>
        )}

        {/* Clear all */}
        {legCount > 0 && (
          <button
            onClick={onClearAll}
            className="w-full rounded-lg py-2 text-sm font-medium transition"
            style={{
              backgroundColor: `${FairBetTheme.negative}15`,
              color: FairBetTheme.negative,
              border: `1px solid ${FairBetTheme.negative}30`,
            }}
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}

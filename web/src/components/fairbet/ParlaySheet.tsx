"use client";

import type { APIBet } from "@/lib/types";
import { formatOdds } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { FairBetTheme } from "@/lib/theme";
import { LeagueBadge } from "./LeagueBadge";
import {
  formatProbability,
  getConfidenceColor,
  betId,
} from "@/lib/fairbet-utils";

interface ParlaySheetProps {
  open: boolean;
  onClose: () => void;
  parlayBets: APIBet[];
  parlayOdds: number;
  parlayProbability: number;
  parlayConfidence: string;
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
  onRemoveLeg,
  onClearAll,
}: ParlaySheetProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);

  if (!open) return null;

  const legCount = parlayBets.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5 space-y-5"
        style={{
          backgroundColor: FairBetTheme.cardBackground,
          border: `1px solid ${FairBetTheme.borderSubtle}`,
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
              backgroundColor: FairBetTheme.surfaceTint,
              border: `1px solid ${FairBetTheme.info}30`,
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: FairBetTheme.info }}>
              {legCount} Leg Parlay
            </div>
            <div className="text-2xl font-bold text-neutral-50">
              {parlayOdds !== 0
                ? formatOdds(parlayOdds, oddsFormat)
                : "---"}
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Fair Probability
                </div>
                <div className="text-sm font-semibold text-neutral-50">
                  {parlayProbability > 0 ? formatProbability(parlayProbability) : "N/A"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
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
                    {parlayConfidence}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {legCount < 2 && (
          <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {legCount === 0
              ? "Add bets from the list to build a parlay."
              : "Add at least one more leg to see parlay odds."}
          </div>
        )}

        {/* Leg list */}
        {legCount > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Legs
            </h3>
            {parlayBets.map((bet) => {
              const id = betId(bet);
              return (
                <div
                  key={id}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: FairBetTheme.surfaceTint,
                    border: `1px solid ${FairBetTheme.cardBorder}`,
                  }}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <LeagueBadge league={bet.league_code} />
                      <span className="text-xs font-semibold text-neutral-50 truncate">
                        {bet.selectionDisplay ?? bet.selection_key}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {bet.away_team} @ {bet.home_team}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {bet.reference_price != null && (
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>
                          Fair: {formatOdds(bet.reference_price, oddsFormat)}
                        </span>
                      )}
                      {bet.true_prob != null && (
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>
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

        {/* Disclaimer */}
        {legCount >= 2 && (
          <p
            className="text-[10px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Parlay fair odds assume independent legs. Correlated selections (e.g.
            same game) may not be accurately priced. This is for informational
            purposes only.
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

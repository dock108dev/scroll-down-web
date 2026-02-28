"use client";

import { useState } from "react";
import type { APIBet } from "@/lib/types";
import { cn, formatOdds } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import {
  formatProbability,
  getConfidenceColor,
} from "@/lib/fairbet-utils";

interface FairExplainerSheetProps {
  open: boolean;
  onClose: () => void;
  bet: APIBet | null;
}

export function FairExplainerSheet({
  open,
  onClose,
  bet,
}: FairExplainerSheetProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const [showImpliedProbs, setShowImpliedProbs] = useState(false);

  if (!open || !bet) return null;

  const method = bet.ev_method;
  const fairProb = bet.true_prob ?? 0;
  const fairOdds = bet.fairAmericanOdds;
  const sharpRefPrice = bet.reference_price;

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
          <h2 className="text-base font-semibold text-white">Fair Value Breakdown</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-sm px-2 py-1"
          >
            Close
          </button>
        </div>

        {/* Summary card */}
        <div
          className="rounded-xl p-3.5 space-y-2"
          style={{
            backgroundColor: FairBetTheme.surfaceTint,
            border: `1px solid ${FairBetTheme.borderSubtle}`,
          }}
        >
          <div className="text-sm font-semibold text-white">{bet.selectionDisplay ?? bet.selection_key}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {bet.away_team} @ {bet.home_team}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <StatBlock
              label="Estimated Fair Price"
              value={fairOdds != null ? formatOdds(fairOdds, oddsFormat) : "N/A"}
              large
            />
            {sharpRefPrice != null && (
              <StatBlock
                label="Sharp Reference"
                value={formatOdds(sharpRefPrice, oddsFormat)}
              />
            )}
          </div>
          <div className="text-center text-xs pt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Implied probability: {fairProb > 0 ? formatProbability(fairProb) : "N/A"}
          </div>
        </div>

        {/* Method */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            How it was calculated
          </h3>
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: FairBetTheme.surfaceSecondary,
              color: FairBetTheme.info,
            }}
          >
            {bet.evMethodDisplayName ?? method ?? "Unknown"}
          </div>
        </div>

        {/* Step-by-step math walkthrough */}
        {bet.explanation_steps && bet.explanation_steps.length > 0 && (
          <div className="space-y-2">
            {bet.explanation_steps.map((step) => (
              <div
                key={step.step_number}
                className="rounded-lg p-3 space-y-1.5"
                style={{
                  backgroundColor: FairBetTheme.surfaceTint,
                  border: `1px solid ${FairBetTheme.cardBorder}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: FairBetTheme.info }}
                  >
                    {step.step_number}
                  </span>
                  <span className="text-xs font-semibold text-white">{step.title}</span>
                </div>
                {step.description && (
                  <p className="text-xs pl-7" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {step.description}
                  </p>
                )}
                {step.detail_rows?.map((row, i) => (
                  <div key={i} className="flex justify-between pl-7 text-xs font-mono">
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>{row.label}</span>
                    <span
                      className={row.is_highlight ? "font-bold" : "font-semibold"}
                      style={{ color: row.is_highlight ? FairBetTheme.positive : "white" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Per-book implied probabilities */}
        <div className="space-y-2">
          <button
            onClick={() => setShowImpliedProbs((p) => !p)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <svg
              className={cn("w-3 h-3 transition-transform", showImpliedProbs && "rotate-90")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
            Per-book implied probabilities
          </button>
          {showImpliedProbs && (
            <div className="space-y-1">
              {bet.books.map((bp) => {
                const ip = bp.implied_prob ?? 0;
                return (
                  <div
                    key={bp.book}
                    className="flex items-center justify-between rounded px-3 py-1.5 text-xs"
                    style={{ backgroundColor: FairBetTheme.surfaceTint }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {bookAbbreviation(bp.book)}
                      </span>
                      {bp.is_sharp && (
                        <span style={{ color: FairBetTheme.info }} className="text-[10px]">
                          ★
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-white font-mono">{formatOdds(bp.price, oddsFormat)}</span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {ip > 0 ? formatProbability(ip) : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* What is this? */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            What is this?
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            {bet.evMethodExplanation ?? "The method used to estimate the fair probability for this market."}
          </p>
        </div>

        {/* Estimate quality */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            Estimate Quality
          </h3>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: FairBetTheme.surfaceTint,
              border: `1px solid ${FairBetTheme.cardBorder}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getConfidenceColor(bet.ev_confidence_tier) }}
            />
            <span className="text-xs font-semibold text-white">
              {bet.confidenceDisplayLabel ?? "N/A"}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              {bet.ev_confidence_tier === "full" || bet.ev_confidence_tier === "sharp" || bet.ev_confidence_tier === "high"
                ? "Broad book coverage — high confidence"
                : bet.ev_confidence_tier === "decent" || bet.ev_confidence_tier === "market" || bet.ev_confidence_tier === "medium"
                  ? "Moderate book coverage — reasonable confidence"
                  : "Limited data available — lower confidence"}
            </span>
          </div>
        </div>

        {/* Data sources */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            Data Sources
          </h3>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {bet.books.length} sportsbooks compared
            {bet.books.some((b) => b.is_sharp) && (
              <span>
                {" "}
                &middot; Sharp books marked with{" "}
                <span style={{ color: FairBetTheme.info }}>★</span>
              </span>
            )}
          </p>
        </div>

        {/* Disclaimer */}
        <p
          className="text-[10px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          This analysis is for informational purposes only and does not constitute
          financial or gambling advice. Past performance does not guarantee future
          results. Always gamble responsibly.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div className="text-center space-y-0.5">
      <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </div>
      <div
        className={cn("font-bold", large ? "text-2xl" : "text-sm")}
        style={{ color: color ?? "white" }}
      >
        {value}
      </div>
    </div>
  );
}

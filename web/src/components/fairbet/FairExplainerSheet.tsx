"use client";

import type { APIBet } from "@/lib/types";
import { cn, formatOdds } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import {
  formatProbability,
  getConfidenceColor,
} from "@/lib/fairbet-utils";

const SHIN_PAPER_URL =
  "https://www.sciencedirect.com/science/article/abs/pii/S0169207014000533?via%3Dihub";

/** Check if the bet's method or explanation steps reference the Shin model */
function hasShinReference(bet: APIBet): boolean {
  const method = (bet.evMethodDisplayName ?? bet.ev_method ?? "").toLowerCase();
  if (method.includes("shin")) return true;
  return (
    bet.explanation_steps?.some(
      (s) =>
        s.title?.toLowerCase().includes("shin") ||
        s.detail_rows?.some((r) => r.label.toLowerCase().includes("shin")),
    ) ?? false
  );
}

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
          backgroundColor: "var(--fb-card-bg)",
          border: "1px solid var(--fb-border-subtle)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-50">Fair Value Breakdown</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-50 text-sm px-2 py-1"
          >
            Close
          </button>
        </div>

        {/* Summary card */}
        <div
          className="rounded-xl p-3.5 space-y-2"
          style={{
            backgroundColor: "var(--fb-surface-tint)",
            border: "1px solid var(--fb-border-subtle)",
          }}
        >
          <div className="text-sm font-semibold text-neutral-50">{bet.selectionDisplay ?? bet.selection_key}</div>
          <div className="text-xs text-neutral-500">
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
          <div className="text-center text-xs pt-1 text-neutral-500">
            Implied probability: {fairProb > 0 ? formatProbability(fairProb) : "N/A"}
          </div>
        </div>

        {/* Method */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            How it was calculated
          </h3>
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              color: FairBetTheme.info,
            }}
          >
            {bet.evMethodDisplayName ?? method ?? "Unknown"}
          </div>
          {hasShinReference(bet) && (
            <a
              href={SHIN_PAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 no-underline px-2 py-1 rounded-md transition"
              style={{ backgroundColor: "var(--fb-surface-secondary)" }}
            >
              Devig method research
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
              </svg>
            </a>
          )}
        </div>

        {/* Step-by-step math walkthrough */}
        {bet.explanation_steps && bet.explanation_steps.length > 0 && (
          <div className="space-y-2">
            {bet.explanation_steps.map((step) => (
              <div
                key={step.step_number}
                className="rounded-lg p-3 space-y-1.5"
                style={{
                  backgroundColor: "var(--fb-surface-tint)",
                  border: "1px solid var(--fb-card-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: FairBetTheme.info }}
                  >
                    {step.step_number}
                  </span>
                  <span className="text-xs font-semibold text-neutral-50">{step.title}</span>
                </div>
                {step.description && (
                  <p className="text-xs pl-7 text-neutral-500">
                    {step.description}
                  </p>
                )}
                {step.detail_rows?.map((row, i) => (
                  <div key={i} className="flex justify-between pl-7 text-xs tabular-nums">
                    <span className="text-neutral-500">{row.label}</span>
                    <span
                      className={row.is_highlight ? "font-bold" : "font-semibold"}
                      style={{ color: row.is_highlight ? FairBetTheme.positive : "var(--ds-text-primary)" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Estimate quality */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Estimate Quality
          </h3>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--fb-surface-tint)",
              border: "1px solid var(--fb-card-border)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getConfidenceColor(bet.ev_confidence_tier) }}
            />
            <span className="text-xs font-semibold text-neutral-50">
              {bet.confidenceDisplayLabel ?? "N/A"}
            </span>
            <span className="text-xs text-neutral-500">
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Data Sources
          </h3>
          <p className="text-xs text-neutral-500">
            {bet.books.length} sportsbooks compared
          </p>
        </div>

        {/* Per-book implied probabilities */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Per-Book Implied Probabilities
          </h3>
          <div className="space-y-1">
            {bet.books.map((bp) => {
              const ip = bp.implied_prob ?? 0;
              return (
                <div
                  key={bp.book}
                  className="flex items-center justify-between rounded px-3 py-1.5 text-xs"
                  style={{ backgroundColor: "var(--fb-surface-tint)" }}
                >
                  <span className="font-medium text-neutral-50">
                    {bookAbbreviation(bp.book)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-neutral-50 tabular-nums">{formatOdds(bp.price, oddsFormat)}</span>
                    <span className="text-neutral-500">
                      {ip > 0 ? formatProbability(ip) : "—"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <p
          className="text-[10px] leading-relaxed text-neutral-600"
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
      <div className="text-[10px] text-neutral-500">
        {label}
      </div>
      <div
        className={cn("font-bold", large ? "text-2xl" : "text-sm")}
        style={{ color: color ?? "var(--ds-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

"use client";

import type { GameDetailResponse, OddsEntry } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { useReadState } from "@/stores/read-state";
import { formatOdds } from "@/lib/utils";
import { SocialSection } from "./SocialSection";

interface WrapUpSectionProps {
  data: GameDetailResponse;
}

/** Outcome keys shown in the top section */
const OUTCOME_KEYS = new Set([
  "winner",
  "spread_outcome_label",
  "total_outcome_label",
  "ml_outcome_label",
  "opening_spread_outcome_label",
  "opening_total_outcome_label",
  "opening_ml_outcome_label",
  "moneyline_upset",
]);

/** Human-readable label from a snake_case key */
function humanLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a metric value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(value > 1 || value < -1 ? 1 : 4);
  }
  return String(value);
}

/** Get the best price for a market+side from a set of odds entries */
function getBestForMarket(
  entries: OddsEntry[],
  marketType: string,
  side?: string,
): OddsEntry | undefined {
  return entries
    .filter(
      (e) =>
        e.marketType === marketType &&
        (side === undefined || e.side === side),
    )
    .sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))[0];
}

/** Build opening vs closing line comparisons from odds data */
function buildLineComparisons(odds: OddsEntry[]): {
  label: string;
  openPrice?: number;
  closePrice?: number;
  line?: number;
}[] {
  const opening = odds.filter((o) => !o.isClosingLine);
  const closing = odds.filter((o) => o.isClosingLine);
  const results: { label: string; openPrice?: number; closePrice?: number; line?: number }[] = [];

  for (const mt of ["spread", "moneyline", "total"] as const) {
    for (const side of ["home", "away", "over", "under"]) {
      const openEntry = getBestForMarket(opening, mt, side);
      const closeEntry = getBestForMarket(closing, mt, side);
      if (openEntry?.price != null || closeEntry?.price != null) {
        const sideLabel = side.charAt(0).toUpperCase() + side.slice(1);
        const mtLabel = mt.charAt(0).toUpperCase() + mt.slice(1);
        const entry = closeEntry ?? openEntry;
        results.push({
          label: `${sideLabel} ${mtLabel}`,
          openPrice: openEntry?.price ?? undefined,
          closePrice: closeEntry?.price ?? undefined,
          line: entry?.line ?? undefined,
        });
      }
    }
  }

  return results;
}

export function WrapUpSection({ data }: WrapUpSectionProps) {
  const metrics = data.derivedMetrics;
  const odds = data.odds;
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const isRead = useReadState((s) => s.isRead);
  const outcomeRevealed = scoreRevealMode === "always" || isRead(data.game.id);

  const hasMetrics = metrics && Object.keys(metrics).length > 0;
  const hasOdds = odds && odds.length > 0;

  if (!hasMetrics && !hasOdds) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No wrap-up data available
      </div>
    );
  }

  // derivedMetrics sections
  const entries = hasMetrics ? Object.entries(metrics) : [];
  const outcomes = entries.filter(([k]) => OUTCOME_KEYS.has(k));
  const keyMetrics = entries.filter(([k]) => !OUTCOME_KEYS.has(k));

  // Odds-based line comparisons (always show if odds exist)
  const lineComparisons = hasOdds ? buildLineComparisons(odds) : [];

  return (
    <div className="px-4 space-y-4">
      {/* Outcomes */}
      {outcomes.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Outcomes
          </h3>
          <div className="space-y-2">
            {outcomes.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">{humanLabel(key)}</span>
                <span className="text-base font-medium text-neutral-100">
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics — two-column grid matching iOS */}
      {keyMetrics.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Key Metrics
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {keyMetrics.map(([key, value]) => (
              <div key={key}>
                <div className="text-xs text-neutral-500 leading-tight">
                  {humanLabel(key)}
                </div>
                <div className="text-base font-medium text-neutral-100 mt-0.5">
                  {formatValue(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opening vs Closing Lines (from odds data) */}
      {lineComparisons.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Opening vs Closing Lines
          </h3>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-neutral-500 font-medium mb-2">
              <span className="flex-1">Market</span>
              <span className="w-20 text-center">Open</span>
              <span className="w-20 text-center">Close</span>
            </div>
            {lineComparisons.map((comp, i) => (
              <div
                key={i}
                className="flex items-center py-1.5 text-sm border-t border-neutral-800/30"
              >
                <span className="flex-1 text-neutral-300 text-sm truncate pr-2">
                  {comp.label}
                  {comp.line != null && (
                    <span className="text-neutral-500 ml-1">
                      {comp.line > 0 ? "+" : ""}{comp.line}
                    </span>
                  )}
                </span>
                <span className="w-20 text-center font-mono text-sm text-neutral-400">
                  {comp.openPrice != null
                    ? formatOdds(comp.openPrice, oddsFormat)
                    : "—"}
                </span>
                <span className="w-20 text-center font-mono text-sm text-neutral-200">
                  {comp.closePrice != null
                    ? formatOdds(comp.closePrice, oddsFormat)
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Postgame Reactions */}
      <SocialSection posts={data.socialPosts} phase="postgame" outcomeRevealed={outcomeRevealed} />
    </div>
  );
}

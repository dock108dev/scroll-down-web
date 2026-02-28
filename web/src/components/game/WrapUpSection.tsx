"use client";

import { useEffect } from "react";
import type { GameDetailResponse, OddsEntry } from "@/lib/types";
import { isFinal } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { useReadState } from "@/stores/read-state";
import { formatOdds } from "@/lib/utils";
import { SocialSection } from "./SocialSection";

interface WrapUpSectionProps {
  data: GameDetailResponse;
}

// ─── Bet outcome builder ────────────────────────────────

interface BetOutcome {
  market: string;
  line?: string;
  openPrice?: number;
  closePrice?: number;
  result: string;
}

function buildBetOutcomes(
  metrics: Record<string, unknown> | undefined,
  awayLabel: string,
  homeLabel: string,
): BetOutcome[] {
  if (!metrics) return [];
  const m = (k: string) => metrics[k];
  const num = (v: unknown) => (v != null ? Number(v) : undefined);
  const fmtLine = (v: unknown) => {
    if (v == null) return undefined;
    const n = Number(v);
    return `${n > 0 ? "+" : ""}${n}`;
  };

  const outcomes: BetOutcome[] = [];

  // Spread — show away team's perspective with team name
  if (m("spread_outcome_label") != null) {
    outcomes.push({
      market: "Spread",
      line: `${awayLabel} ${fmtLine(m("closing_spread_away")) ?? ""}`.trim(),
      openPrice: num(m("opening_spread_away_price")),
      closePrice: num(m("closing_spread_away_price")),
      result: String(m("spread_outcome_label")),
    });
  }

  // Total
  if (m("total_outcome_label") != null) {
    const closingTotal = m("closing_total");
    outcomes.push({
      market: "Total",
      line: closingTotal != null ? String(closingTotal) : undefined,
      openPrice: num(m("opening_total_price")),
      closePrice: num(m("closing_total_price")),
      result: String(m("total_outcome_label")),
    });
  }

  // Moneyline — show winner's line with team name + opening price
  if (m("ml_outcome_label") != null) {
    const winner = String(m("winner") ?? "");
    const isAway = winner === "away";
    const winnerLabel = isAway ? awayLabel : homeLabel;
    outcomes.push({
      market: "Moneyline",
      line: winnerLabel,
      openPrice: num(m(isAway ? "opening_ml_away" : "opening_ml_home")),
      closePrice: num(m(isAway ? "closing_ml_away" : "closing_ml_home")),
      result: String(m("ml_outcome_label")),
    });
  }

  return outcomes;
}

// ─── Fallback: odds-based line comparisons ──────────────

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

function buildLineComparisons(odds: OddsEntry[]): {
  label: string;
  openPrice?: number;
  closePrice?: number;
  line?: number;
}[] {
  const opening = odds.filter((o) => !o.isClosingLine);
  const closing = odds.filter((o) => o.isClosingLine);
  const results: {
    label: string;
    openPrice?: number;
    closePrice?: number;
    line?: number;
  }[] = [];

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

// ─── Component ──────────────────────────────────────────

export function WrapUpSection({ data }: WrapUpSectionProps) {
  const metrics = data.derivedMetrics;
  const odds = data.odds;
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const isRead = useReadState((s) => s.isRead);
  const markRead = useReadState((s) => s.markRead);
  const outcomeRevealed = scoreRevealMode === "always" || isRead(data.game.id);

  // Mark game as read when Wrap-Up renders (it only mounts when expanded).
  // This ensures outcomeRevealed flips to true so postgame posts are visible.
  useEffect(() => {
    if (isFinal(data.game.status)) {
      markRead(data.game.id, data.game.status);
    }
  }, [data.game.id, data.game.status, markRead]);

  const game = data.game;
  const awayLabel = game.awayTeamAbbr ?? game.awayTeam;
  const homeLabel = game.homeTeamAbbr ?? game.homeTeam;
  const betOutcomes = buildBetOutcomes(metrics, awayLabel, homeLabel);

  // Fallback when derivedMetrics has no outcome labels
  const lineComparisons =
    betOutcomes.length === 0 && odds?.length
      ? buildLineComparisons(odds)
      : [];

  const hasContent =
    betOutcomes.length > 0 ||
    lineComparisons.length > 0 ||
    data.socialPosts?.length > 0;

  if (!hasContent) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No wrap-up data available
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      {/* Primary: structured bet outcomes from derivedMetrics */}
      {betOutcomes.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Bet Outcomes
              </h3>
              <div className="relative group">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-neutral-500 cursor-help"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg bg-neutral-800 border border-neutral-700 p-3 text-xs text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-20 shadow-lg">
                  Prices show opening &rarr; closing line movement. Base lines
                  sourced from Pinnacle when available.
                </div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-neutral-800/50">
            {betOutcomes.map((o) => (
              <div key={o.market} className="px-4 py-3">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-neutral-400 uppercase">
                      {o.market}
                    </span>
                    {o.line && (
                      <span className="text-sm text-neutral-300 tabular-nums">
                        {o.line}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 text-xs tabular-nums">
                    {o.openPrice != null && (
                      <span className="text-neutral-500">
                        {formatOdds(o.openPrice, oddsFormat)}
                      </span>
                    )}
                    {o.openPrice != null && o.closePrice != null && (
                      <span className="text-neutral-600">&rarr;</span>
                    )}
                    {o.closePrice != null && (
                      <span className="text-neutral-300">
                        {formatOdds(o.closePrice, oddsFormat)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-neutral-200">{o.result}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: line movement table when no outcome data */}
      {lineComparisons.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Line Movement
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
                      {comp.line > 0 ? "+" : ""}
                      {comp.line}
                    </span>
                  )}
                </span>
                <span className="w-20 text-center tabular-nums text-sm text-neutral-400">
                  {comp.openPrice != null
                    ? formatOdds(comp.openPrice, oddsFormat)
                    : "—"}
                </span>
                <span className="w-20 text-center tabular-nums text-sm text-neutral-200">
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
      <SocialSection
        posts={data.socialPosts}
        phase="postgame"
        outcomeRevealed={outcomeRevealed}
      />
    </div>
  );
}

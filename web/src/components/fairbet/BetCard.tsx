"use client";

import { memo, useState, useRef, useEffect } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds, formatDate, cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { FAIRBET } from "@/lib/config";
import { BookComparisonRow } from "./BookComparisonRow";
import { LeagueBadge } from "./LeagueBadge";
import {
  formatEVDollars,
  formatProbability,
  getEVColor,
  getEVTier,
  betId,
} from "@/lib/fairbet-utils";

function getLatestObservedAt(books: APIBet["books"]): number {
  let latest = 0;
  for (const b of books) {
    const t = b.observed_at ? new Date(b.observed_at).getTime() : 0;
    if (t > latest) latest = t;
  }
  return latest;
}

function buildAttributionLabel(
  bookCount: number,
  latestMs: number,
  nowMs: number
): { text: string; isStale: boolean } {
  if (latestMs === 0) return { text: `From ${bookCount} book${bookCount !== 1 ? "s" : ""}`, isStale: false };
  const ageMs = nowMs - latestMs;
  const ageMin = Math.floor(ageMs / 60_000);
  const bookLabel = `From ${bookCount} book${bookCount !== 1 ? "s" : ""}`;
  if (ageMs < FAIRBET.ATTRIBUTION_FRESH_MS) {
    return { text: bookLabel, isStale: false };
  }
  if (ageMs < FAIRBET.ATTRIBUTION_STALE_MS) {
    return { text: `${bookLabel} · Updated ${ageMin}m ago`, isStale: false };
  }
  return { text: `${bookLabel} · May be delayed · ${ageMin}m ago`, isStale: true };
}

const EXPLANATION_TEXT =
  "This is the estimated fair price for this bet based on removing the book's margin. If the market price is better than this, the bet has positive expected value.";

interface BetCardProps {
  bet: APIBet;
  onToggleParlay?: (id: string) => void;
  isInParlay?: boolean;
  onShowExplainer?: (bet: APIBet) => void;
}

export const BetCard = memo(function BetCard({
  bet,
  onToggleParlay,
  isInParlay,
  onShowExplainer,
}: BetCardProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const preferredBook = useSettings((s) => s.preferredSportsbook);
  const [showFullBookName, setShowFullBookName] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);

  const latestObservedAt = getLatestObservedAt(bet.books);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), FAIRBET.ATTRIBUTION_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  const attribution = buildAttributionLabel(bet.books.length, latestObservedAt, now);

  useEffect(() => {
    if (!showExplanation) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (explanationRef.current && !explanationRef.current.contains(e.target as Node)) {
        setShowExplanation(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showExplanation]);

  useEffect(() => {
    if (!showExplanation) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowExplanation(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showExplanation]);

  // Best book from API
  const bestBook = bet.bestBook
    ? bet.books.find((b) => b.book === bet.bestBook) ?? null
    : null;

  // User's preferred book price (if different from best)
  const preferredBookPrice = preferredBook
    ? bet.books.find((b) => b.book.toLowerCase() === preferredBook.toLowerCase())
    : null;

  // Primary display: preferred if available, else best
  const primaryBook = preferredBookPrice ?? bestBook;
  const isPrimaryBest = primaryBook === bestBook;

  const ev = bestBook?.display_ev ?? bestBook?.ev_percent ?? 0;
  const evTier = getEVTier(ev);
  const id = betId(bet);

  // Card border — tier drives color; parlay overrides all
  let borderStyle: React.CSSProperties = {
    borderWidth: 1,
    borderColor: "var(--fb-card-border)",
  };
  if (isInParlay) {
    borderStyle = {
      borderWidth: 1.5,
      borderColor: `${FairBetTheme.info}99`,
    };
  } else if (evTier === "strong") {
    borderStyle = { borderWidth: 2, borderColor: "var(--ev-strong-border)" };
  } else if (evTier === "good") {
    borderStyle = { borderWidth: 1.5, borderColor: "var(--ev-good-border)" };
  } else if (evTier === "marginal") {
    borderStyle = { borderWidth: 1, borderColor: "var(--ev-marginal-border)" };
  }

  // Format game time
  const gameDate = new Date(bet.game_date);
  const timeStr = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = formatDate(bet.game_date);

  return (
    <div
      data-testid="bet-card"
      className="rounded-xl px-3 py-2 space-y-1.5 min-w-0"
      style={{
        backgroundColor: "var(--fb-card-bg)",
        ...borderStyle,
        borderStyle: "solid",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {/* ── Section 1: Description ── */}
      <div className="space-y-1">
        {/* Row 1: Selection + League badge + Market */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-50 truncate">
            {bet.selectionDisplay ?? bet.selection_key}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <LeagueBadge league={bet.league_code} />
            {evTier !== "no-edge" && (
              <span
                data-testid="ev-tier-badge"
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `var(--ev-${evTier}-bg)`,
                  color: `var(--ev-${evTier}-text)`,
                  border: `1px solid var(--ev-${evTier}-border)`,
                }}
              >
                {evTier === "strong" ? "Strong" : evTier === "good" ? "Good" : "Marginal"}
              </span>
            )}
            <span className="text-[10px] font-medium text-neutral-500">
              {bet.marketDisplayName ?? bet.market_key}
            </span>
          </div>
        </div>

        {/* Row 2: Context + Time */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {bet.away_team} @ {bet.home_team}
          </span>
          <span className="text-[10px] text-neutral-500">
            {dateStr} {timeStr}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full" style={{ backgroundColor: "var(--fb-border-subtle)" }} />

      {/* ── Section 2: Action ── */}
      <div className="space-y-1.5">
        {/* Primary Book Row */}
        {primaryBook && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFullBookName((p) => !p)}
              className="text-xs font-medium px-1.5 py-0.5 rounded text-neutral-400"
            >
              {showFullBookName ? primaryBook.book : bookAbbreviation(primaryBook.book)}
            </button>
            <span className="text-sm font-bold text-neutral-50">
              {formatOdds(primaryBook.price, oddsFormat)}
            </span>
            {isPrimaryBest && (
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: FairBetTheme.successSoft,
                  color: FairBetTheme.positive,
                }}
              >
                Best
              </span>
            )}
            {(primaryBook.display_ev ?? primaryBook.ev_percent) != null && (() => {
              const evVal = primaryBook.display_ev ?? primaryBook.ev_percent ?? 0;
              const { label, isNoEdge } = formatEVDollars(evVal);
              return (
                <span
                  data-testid="ev-dollar-label"
                  className="text-xs font-bold"
                  style={{ color: isNoEdge ? "var(--ds-text-tertiary)" : getEVColor(evVal) }}
                >
                  {label}
                </span>
              );
            })()}
          </div>
        )}

        {/* Best Available Callout (if preferred isn't the best) */}
        {preferredBookPrice && bestBook && preferredBookPrice !== bestBook && (
          <div
            className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg"
            style={{ backgroundColor: "var(--fb-surface-tint)" }}
          >
            <span className="text-neutral-500">Best:</span>
            <span className="font-medium text-neutral-400">
              {bookAbbreviation(bestBook.book)}
            </span>
            <span className="font-bold text-neutral-50">
              {formatOdds(bestBook.price, oddsFormat)}
            </span>
            {(bestBook.display_ev ?? bestBook.ev_percent) != null && (() => {
              const evVal = bestBook.display_ev ?? bestBook.ev_percent ?? 0;
              const { label, isNoEdge } = formatEVDollars(evVal);
              return (
                <span
                  className="font-bold"
                  style={{ color: isNoEdge ? "var(--ds-text-tertiary)" : getEVColor(evVal) }}
                >
                  {label}
                </span>
              );
            })()}
          </div>
        )}

        {/* Fair Reference Row + inline explanation */}
        <div ref={explanationRef}>
          {bet.has_fair && bet.fairAmericanOdds != null ? (
            <button
              data-testid="fairbet-explanation"
              aria-expanded={showExplanation}
              onClick={() => setShowExplanation((p) => !p)}
              className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg w-full text-left"
              style={{
                backgroundColor: "var(--fb-surface-tint)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            >
              <span className="text-neutral-500">Est. fair</span>
              <span className="font-semibold text-neutral-50">
                {formatOdds(bet.fairAmericanOdds, oddsFormat)}
              </span>
              {bet.true_prob != null && (
                <span className="text-[10px] text-neutral-500">
                  ({formatProbability(bet.true_prob)})
                </span>
              )}
              <span
                className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: `${FairBetTheme.info}20`,
                  color: FairBetTheme.info,
                }}
              >
                i
              </span>
            </button>
          ) : (
            <button
              data-testid="fairbet-explanation"
              aria-expanded={showExplanation}
              onClick={() => setShowExplanation((p) => !p)}
              className="flex items-center gap-1 text-xs py-0.5 text-neutral-500"
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: `${FairBetTheme.info}20`,
                  color: FairBetTheme.info,
                }}
              >
                i
              </span>
              <span>How is this calculated?</span>
            </button>
          )}

          {showExplanation && (
            <div
              role="region"
              aria-label="Fair price explanation"
              className="mt-1 rounded-lg px-3 py-2 space-y-2"
              style={{
                backgroundColor: "var(--fb-surface-tint)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            >
              <p className="text-xs text-neutral-400 leading-relaxed">
                {EXPLANATION_TEXT}
              </p>
              {onShowExplainer && bet.has_fair && (
                <button
                  onClick={() => { onShowExplainer(bet); setShowExplanation(false); }}
                  className="text-[11px] font-medium"
                  style={{ color: FairBetTheme.info }}
                >
                  See full breakdown →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Book Comparison Row */}
        {bet.books.length > 0 && (
          <BookComparisonRow books={bet.books} />
        )}

        {/* Parlay button */}
        {onToggleParlay && (
          <button
            onClick={() => onToggleParlay(id)}
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition",
            )}
            style={
              isInParlay
                ? {
                    backgroundColor: `${FairBetTheme.info}20`,
                    color: FairBetTheme.info,
                    border: `1px solid ${FairBetTheme.info}40`,
                  }
                : {
                    backgroundColor: "var(--fb-surface-secondary)",
                    color: "var(--ds-text-tertiary)",
                    border: `1px solid transparent`,
                  }
            }
          >
            {isInParlay ? "\u2713 Parlay" : "+ Parlay"}
          </button>
        )}

        {/* Attribution */}
        <p
          data-testid="fairbet-source-attribution"
          className="text-[10px] pt-0.5"
          style={{ color: attribution.isStale ? "rgb(245, 158, 11)" : "var(--ds-text-tertiary)" }}
        >
          {attribution.text}
        </p>
      </div>
    </div>
  );
});

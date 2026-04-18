"use client";

import { memo, useState } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds, formatDate, cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { MiniBookChip } from "./MiniBookChip";
import { LeagueBadge } from "./LeagueBadge";
import {
  formatEVDollars,
  formatProbability,
  getEVColor,
  getEVTier,
  betId,
} from "@/lib/fairbet-utils";

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
  const [showOtherBooks, setShowOtherBooks] = useState(false);
  const [showFullBookName, setShowFullBookName] = useState(false);

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

  // Other books (exclude primary)
  const otherBooks = bet.books.filter((b) => b !== primaryBook);
  const otherBooksCount = otherBooks.length;

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

        {/* Fair Reference Row - shows fair odds from API */}
        {bet.has_fair && bet.fairAmericanOdds != null && (
          <button
            onClick={() => onShowExplainer?.(bet)}
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
        )}

        {/* Other Books Disclosure */}
        {otherBooksCount > 0 && (
          <div>
            <button
              onClick={() => setShowOtherBooks((p) => !p)}
              className="flex items-center gap-1 text-xs py-1 text-neutral-500"
            >
              <svg
                className={cn("w-3 h-3 transition-transform", showOtherBooks && "rotate-90")}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
              Other books ({otherBooksCount})
            </button>
            {showOtherBooks && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {otherBooks.map((bp) => (
                  <MiniBookChip
                    key={bp.book}
                    book={bp.book}
                    price={formatOdds(bp.price, oddsFormat)}
                    ev={bp.display_ev ?? bp.ev_percent}
                    isSharp={bp.is_sharp}
                  />
                ))}
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
});

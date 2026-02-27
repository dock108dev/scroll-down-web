"use client";

import { useState } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds, cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { MiniBookChip } from "./MiniBookChip";
import { LeagueBadge } from "./LeagueBadge";
import {
  formatEV,
  formatProbability,
  getEVColor,
  getConfidenceColor,
  isConfidenceReliable,
  betId,
} from "@/lib/fairbet-utils";

interface BetCardProps {
  bet: APIBet;
  onToggleParlay?: (id: string) => void;
  isInParlay?: boolean;
  onShowExplainer?: (bet: APIBet) => void;
}

export function BetCard({
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

  const ev = bestBook?.ev_percent ?? 0;
  const hasHighEV = ev >= 5 && isConfidenceReliable(bet.ev_confidence_tier);
  const id = betId(bet);

  // Card border
  let borderStyle: React.CSSProperties = {
    borderWidth: 1,
    borderColor: FairBetTheme.cardBorder,
  };
  if (isInParlay) {
    borderStyle = {
      borderWidth: 1.5,
      borderColor: `${FairBetTheme.info}99`,
    };
  } else if (hasHighEV) {
    borderStyle = {
      borderWidth: 1.5,
      borderColor: `${FairBetTheme.positive}66`,
    };
  }

  // Format game time
  const gameDate = new Date(bet.game_date);
  const timeStr = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = gameDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="rounded-[14px] px-3.5 py-2.5 space-y-2"
      style={{
        backgroundColor: FairBetTheme.cardBackground,
        ...borderStyle,
        borderStyle: "solid",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {/* ── Section 1: Description ── */}
      <div className="space-y-1">
        {/* Row 1: Selection + League badge + Market */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white truncate">
            {bet.selectionDisplay ?? bet.selection_key}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <LeagueBadge league={bet.league_code} />
            <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
              {bet.marketDisplayName ?? bet.market_key}
            </span>
          </div>
        </div>

        {/* Row 2: Context + Time */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {bet.away_team} @ {bet.home_team}
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            {dateStr} {timeStr}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full" style={{ backgroundColor: FairBetTheme.borderSubtle }} />

      {/* ── Section 2: Action ── */}
      <div className="space-y-2">
        {/* Primary Book Row */}
        {primaryBook && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFullBookName((p) => !p)}
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {showFullBookName ? primaryBook.book : bookAbbreviation(primaryBook.book)}
            </button>
            <span className="text-sm font-bold text-white">
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
            {primaryBook.ev_percent != null && (
              <span
                className="text-xs font-bold"
                style={{ color: getEVColor(primaryBook.ev_percent) }}
              >
                {formatEV(primaryBook.ev_percent)}
              </span>
            )}
            {/* Confidence badge */}
            {bet.ev_confidence_tier && bet.ev_confidence_tier !== "none" && (
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  color: getConfidenceColor(bet.ev_confidence_tier),
                  backgroundColor: `${getConfidenceColor(bet.ev_confidence_tier)}1A`,
                }}
              >
                {bet.confidenceDisplayLabel ?? "N/A"}
              </span>
            )}
          </div>
        )}

        {/* Best Available Callout (if preferred isn't the best) */}
        {preferredBookPrice && bestBook && preferredBookPrice !== bestBook && (
          <div
            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
            style={{ backgroundColor: FairBetTheme.surfaceTint }}
          >
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Best:</span>
            <span className="font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              {bookAbbreviation(bestBook.book)}
            </span>
            <span className="font-bold text-white">
              {formatOdds(bestBook.price, oddsFormat)}
            </span>
            {bestBook.ev_percent != null && (
              <span className="font-bold" style={{ color: getEVColor(bestBook.ev_percent) }}>
                {formatEV(bestBook.ev_percent)}
              </span>
            )}
          </div>
        )}

        {/* Fair Reference Row - shows fair odds from API */}
        {bet.has_fair && bet.fairAmericanOdds != null && (
          <button
            onClick={() => onShowExplainer?.(bet)}
            className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg w-full text-left"
            style={{
              backgroundColor: FairBetTheme.surfaceTint,
              border: `1px solid ${FairBetTheme.borderSubtle}`,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Est. fair</span>
            <span className="font-semibold text-white">
              {formatOdds(bet.fairAmericanOdds, oddsFormat)}
            </span>
            {bet.true_prob != null && (
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                ({formatProbability(bet.true_prob)})
              </span>
            )}
            <svg
              className="ml-auto w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              style={{ color: FairBetTheme.info }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        )}

        {/* Other Books Disclosure */}
        {otherBooksCount > 0 && (
          <div>
            <button
              onClick={() => setShowOtherBooks((p) => !p)}
              className="flex items-center gap-1 text-xs py-1"
              style={{ color: "rgba(255,255,255,0.5)" }}
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
                    ev={bp.ev_percent}
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
              "flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition",
            )}
            style={
              isInParlay
                ? {
                    backgroundColor: `${FairBetTheme.info}20`,
                    color: FairBetTheme.info,
                    border: `1px solid ${FairBetTheme.info}40`,
                  }
                : {
                    backgroundColor: FairBetTheme.surfaceSecondary,
                    color: "rgba(255,255,255,0.5)",
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
}

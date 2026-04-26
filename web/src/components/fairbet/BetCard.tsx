"use client";

import { memo, useState } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { useIsPro } from "@/hooks/useIsPro";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { formatOdds, formatDate } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { FEATURE_GATES } from "@/lib/config";
import { BookComparisonRow } from "./BookComparisonRow";
import { LeagueBadge } from "./LeagueBadge";
import { LineMovementRow } from "./LineMovementRow";
import { MonteCarloSheet } from "./MonteCarloSheet";
import { betId } from "@/lib/fairbet-utils";

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
  const isPro = useIsPro();
  const openProGate = useProGateSheet((s) => s.openSheet);
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);

  const bestBook = bet.bestBook
    ? bet.books.find((b) => b.book === bet.bestBook) ?? null
    : null;
  const preferredBookPrice = preferredBook
    ? bet.books.find((b) => (b.book ?? "").toLowerCase() === preferredBook.toLowerCase())
    : null;
  const primaryBook = preferredBookPrice ?? bestBook;

  const id = betId(bet);

  const borderStyle: React.CSSProperties = isInParlay
    ? { borderWidth: 1.5, borderColor: `${FairBetTheme.info}99` }
    : { borderWidth: 1, borderColor: "var(--fb-card-border)" };

  const gameDate = new Date(bet.game_date);
  const timeStr = gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = formatDate(bet.game_date);

  return (
    <div
      data-testid="bet-card"
      className="rounded-xl px-3 py-2.5 space-y-2 min-w-0"
      style={{
        backgroundColor: "var(--fb-card-bg)",
        ...borderStyle,
        borderStyle: "solid",
      }}
    >
      {/* ── Header ── */}
      <div className="space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-50 truncate">
            {bet.selectionDisplay ?? bet.selection_key}
          </span>
          <span className="shrink-0 text-[10px] text-neutral-500">{dateStr} {timeStr}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 min-w-0">
          <span className="truncate">{bet.away_team} @ {bet.home_team}</span>
          <LeagueBadge league={bet.league_code} />
          <span className="truncate">{bet.marketDisplayName ?? bet.market_key}</span>
        </div>
      </div>

      {/* ── Main rows: Best / Fair (left-aligned, tight columns) ── */}
      <div className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
        {primaryBook && (
          <>
            <span className="text-neutral-500">Best price</span>
            <span className="text-[10px] text-neutral-400 uppercase tracking-tight">
              {bookAbbreviation(primaryBook.book)}
            </span>
            <span className="text-sm font-bold text-neutral-50">
              {formatOdds(primaryBook.price, oddsFormat)}
            </span>
          </>
        )}
        {bet.has_fair && bet.fairAmericanOdds != null && (
          <>
            <span className="text-neutral-500">Fair price</span>
            <span />
            <span className="text-neutral-200 font-medium">
              {formatOdds(bet.fairAmericanOdds, oddsFormat)}
            </span>
          </>
        )}
      </div>

      {/* ── Book chip strip — best highlighted, others muted ── */}
      {bet.books.length > 0 && (
        <BookComparisonRow books={bet.books} compact bestOnly={!isPro} />
      )}

      {/* ── Pro-only line movement (small) ── */}
      {isPro && bet.opening_line != null && primaryBook != null && (
        <LineMovementRow
          openingLine={bet.opening_line}
          currentLine={primaryBook.price}
          oddsFormat={oddsFormat}
          isPro={isPro}
        />
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {isPro && onToggleParlay && (
          <ActionButton
            label={isInParlay ? "✓ Parlay" : "+ Parlay"}
            active={!!isInParlay}
            onClick={() => onToggleParlay(id)}
          />
        )}
        {isPro ? (
          <ActionButton
            label="Win sim"
            onClick={() => setShowMonteCarlo(true)}
            testId="montecarlo-button"
          />
        ) : (
          <ActionButton
            label="Win sim"
            onClick={(e) => openProGate(FEATURE_GATES.WIN_PROBABILITY, e.currentTarget)}
            testId="montecarlo-gated"
            badge="Pro"
          />
        )}
        {bet.has_fair && onShowExplainer && (
          <ActionButton
            label="Details"
            onClick={() => onShowExplainer(bet)}
            testId="fairbet-details"
          />
        )}
      </div>

      {isPro && (
        <MonteCarloSheet
          open={showMonteCarlo}
          onClose={() => setShowMonteCarlo(false)}
          bet={bet}
        />
      )}
    </div>
  );
});

function ActionButton({
  label,
  onClick,
  active,
  badge,
  testId,
}: {
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  badge?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition"
      style={
        active
          ? {
              backgroundColor: `${FairBetTheme.info}20`,
              color: FairBetTheme.info,
              border: `1px solid ${FairBetTheme.info}40`,
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-secondary)",
              border: "1px solid transparent",
            }
      }
    >
      {label}
      {badge && (
        <span
          className="text-[9px] font-bold uppercase px-1 py-0.5 rounded-full"
          style={{
            backgroundColor: `${FairBetTheme.info}20`,
            color: FairBetTheme.info,
            border: `1px solid ${FairBetTheme.info}40`,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

"use client";

import { memo, useState, useEffect } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { useIsPro } from "@/hooks/useIsPro";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { formatOdds, formatDate, cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { FAIRBET, FEATURE_GATES } from "@/lib/config";
import { BookComparisonRow } from "./BookComparisonRow";
import { LeagueBadge } from "./LeagueBadge";
import { LineMovementRow } from "./LineMovementRow";
import { LogBetModal } from "./LogBetModal";
import { MonteCarloSheet } from "./MonteCarloSheet";
import { betId, getEdgeLabel, type EdgeLabel } from "@/lib/fairbet-utils";

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
  nowMs: number,
): { text: string; isStale: boolean } {
  if (latestMs === 0) return { text: `From ${bookCount} book${bookCount !== 1 ? "s" : ""}`, isStale: false };
  const ageMs = nowMs - latestMs;
  const ageMin = Math.floor(ageMs / 60_000);
  const bookLabel = `From ${bookCount} book${bookCount !== 1 ? "s" : ""}`;
  if (ageMs < FAIRBET.ATTRIBUTION_FRESH_MS) return { text: bookLabel, isStale: false };
  if (ageMs < FAIRBET.ATTRIBUTION_STALE_MS) return { text: `${bookLabel} · Updated ${ageMin}m ago`, isStale: false };
  return { text: `${bookLabel} · May be delayed · ${ageMin}m ago`, isStale: true };
}

function edgeStyle(label: EdgeLabel): React.CSSProperties {
  if (label === "Strong") {
    return { backgroundColor: `${FairBetTheme.positive}18`, color: FairBetTheme.positive };
  }
  if (label === "Medium") {
    return { backgroundColor: "var(--fb-surface-secondary)", color: "var(--ds-text-secondary)" };
  }
  if (label === "Small") {
    return { backgroundColor: "var(--fb-surface-secondary)", color: "var(--ds-text-tertiary)" };
  }
  return { backgroundColor: "var(--fb-surface-secondary)", color: "var(--ds-text-tertiary)" };
}

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
  const [showLogModal, setShowLogModal] = useState(false);
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);

  const latestObservedAt = getLatestObservedAt(bet.books);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), FAIRBET.ATTRIBUTION_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  const attribution = buildAttributionLabel(bet.books.length, latestObservedAt, now);

  const bestBook = bet.bestBook
    ? bet.books.find((b) => b.book === bet.bestBook) ?? null
    : null;
  const preferredBookPrice = preferredBook
    ? bet.books.find((b) => (b.book ?? "").toLowerCase() === preferredBook.toLowerCase())
    : null;
  const primaryBook = preferredBookPrice ?? bestBook;

  const ev = bestBook?.display_ev ?? bestBook?.ev_percent ?? 0;
  const edge = getEdgeLabel(ev);
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
          {edge !== "None" && (
            <span
              data-testid="edge-label"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={edgeStyle(edge)}
            >
              {edge} edge
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{bet.away_team} @ {bet.home_team}</span>
            <LeagueBadge league={bet.league_code} />
            <span className="truncate">{bet.marketDisplayName ?? bet.market_key}</span>
          </div>
          <span className="shrink-0 text-[10px]">{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* ── Main rows: Best / Fair / Edge ── */}
      <div className="space-y-1">
        {primaryBook && (
          <PriceRow
            label="Best price"
            book={bookAbbreviation(primaryBook.book)}
            price={formatOdds(primaryBook.price, oddsFormat)}
            emphasis
          />
        )}
        {bet.has_fair && bet.fairAmericanOdds != null && (
          <PriceRow label="Fair price" price={formatOdds(bet.fairAmericanOdds, oddsFormat)} />
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
        {isPro && primaryBook && (
          <ActionButton
            label="+ Log bet"
            onClick={() => setShowLogModal(true)}
            testId="log-bet-button"
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

      {/* ── Attribution ── */}
      <p
        data-testid="fairbet-source-attribution"
        className="text-[10px] pt-0.5"
        style={{ color: attribution.isStale ? "rgb(245, 158, 11)" : "var(--ds-text-tertiary)" }}
      >
        {attribution.text}
      </p>

      {showLogModal && primaryBook && (
        <LogBetModal
          gameId={bet.game_id}
          leagueCode={bet.league_code}
          homeTeam={bet.home_team}
          awayTeam={bet.away_team}
          gameDate={bet.game_date}
          marketKey={bet.market_key}
          marketLabel={bet.marketDisplayName ?? bet.market_key}
          selectionDisplay={bet.selectionDisplay ?? bet.selection_key}
          book={primaryBook.book}
          placedOdds={primaryBook.price}
          oddsFormat={oddsFormat}
          onClose={() => setShowLogModal(false)}
        />
      )}

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

function PriceRow({
  label,
  book,
  price,
  emphasis,
}: {
  label: string;
  book?: string;
  price: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <div className="flex items-baseline gap-1.5">
        {book && <span className="text-[10px] text-neutral-400">{book}</span>}
        <span className={cn(emphasis ? "text-sm font-bold text-neutral-50" : "text-neutral-200 font-medium")}>
          {price}
        </span>
      </div>
    </div>
  );
}

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

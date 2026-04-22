"use client";

import { memo, useState, useRef, useEffect } from "react";
import type { APIBet } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { useTier } from "@/stores/tier";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { formatOdds, formatDate, cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { FAIRBET, FEATURE_GATES } from "@/lib/config";
import { BookComparisonRow } from "./BookComparisonRow";
import { LeagueBadge } from "./LeagueBadge";
import { LineMovementRow } from "./LineMovementRow";
import { EVSimulator } from "./EVSimulator";
import { LogBetModal } from "./LogBetModal";
import { MonteCarloSheet } from "./MonteCarloSheet";
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
  const isPro = useTier((s) => s.tier) === "pro";
  const openProGate = useProGateSheet((s) => s.openSheet);
  const [showFullBookName, setShowFullBookName] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);
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
    ? bet.books.find((b) => (b.book ?? "").toLowerCase() === preferredBook.toLowerCase())
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

  // EV dollar value for the teaser label shown to free users
  const primaryEvVal = primaryBook != null
    ? (primaryBook.display_ev ?? primaryBook.ev_percent ?? null)
    : null;

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
        {isPro ? (
          /* ── Pro path: full book details visible ── */
          <>
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
          </>
        ) : (
          /* ── Free path: EV dollar teaser + blurred book details ── */
          <>
            {/* EV dollar label — visible above the blur as the teaser */}
            {primaryEvVal != null && (() => {
              const { label, isNoEdge } = formatEVDollars(primaryEvVal);
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500">Expected value:</span>
                  <span
                    data-testid="ev-dollar-label"
                    className="text-xs font-bold"
                    style={{ color: isNoEdge ? "var(--ds-text-tertiary)" : getEVColor(primaryEvVal) }}
                  >
                    {label}
                  </span>
                </div>
              );
            })()}

            {/* Blurred region — book names, odds, comparison, fair price */}
            <button
              data-testid="book-details-blur"
              onClick={(e) => openProGate(FEATURE_GATES.FULL_FAIRBET, e.currentTarget)}
              className="relative w-full rounded-lg overflow-hidden text-left"
              aria-label="Unlock book details — upgrade to Pro"
            >
              {/* Content rendered at full fidelity but visually blurred */}
              <div
                className="space-y-1.5 py-1"
                style={{ filter: "blur(4px)", userSelect: "none" }}
                aria-hidden="true"
              >
                {/* Primary Book Row */}
                {primaryBook && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded text-neutral-400">
                      {bookAbbreviation(primaryBook.book)}
                    </span>
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
                  </div>
                )}

                {/* Best Available Callout */}
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
                  </div>
                )}

                {/* Fair price row */}
                {bet.has_fair && bet.fairAmericanOdds != null && (
                  <div
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg"
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
                  </div>
                )}

                {/* Book Comparison Row */}
                {bet.books.length > 0 && (
                  <BookComparisonRow books={bet.books} />
                )}
              </div>

              {/* Lock icon overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div
                  className="rounded-full p-2.5 flex items-center justify-center"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--color-neutral-200, #e5e5e5)" }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
            </button>
          </>
        )}

        {/* Line Movement Row — Pro-gated, omitted when opening_line is absent */}
        {bet.opening_line != null && primaryBook != null && (
          <LineMovementRow
            openingLine={bet.opening_line}
            currentLine={primaryBook.price}
            oddsFormat={oddsFormat}
            isPro={isPro}
          />
        )}

        {/* EV Simulator */}
        <EVSimulator evPercent={ev} isPro={isPro} />

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

        {/* Log this bet — Pro only */}
        {isPro && primaryBook && (
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-tertiary)",
              border: "1px solid transparent",
            }}
            data-testid="log-bet-button"
          >
            + Log bet
          </button>
        )}

        {/* Win Probability — Pro only, gated button for free */}
        {isPro ? (
          <button
            onClick={() => setShowMonteCarlo(true)}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-tertiary)",
              border: "1px solid transparent",
            }}
            data-testid="montecarlo-button"
          >
            Win Probability
          </button>
        ) : (
          <button
            onClick={(e) => openProGate(FEATURE_GATES.WIN_PROBABILITY, e.currentTarget)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-tertiary)",
              border: "1px solid transparent",
            }}
            data-testid="montecarlo-gated"
          >
            Win Probability
            <span
              className="text-[9px] font-bold uppercase px-1 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: `${FairBetTheme.info}20`,
                color: FairBetTheme.info,
                border: `1px solid ${FairBetTheme.info}40`,
              }}
            >
              Pro
            </span>
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

      {/* Log Bet Modal */}
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

      {/* Monte Carlo Win Probability Sheet — Pro only */}
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

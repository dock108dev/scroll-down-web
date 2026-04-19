"use client";

import { memo } from "react";
import type { APIBet } from "@/lib/types";
import { useSectionLayout } from "@/stores/section-layout";
import { isMainlineMarket, betId } from "@/lib/fairbet-utils";
import { cn } from "@/lib/utils";
import { BetCard } from "./BetCard";

const MORE_MARKETS_SECTION = "fairbet-more-markets";

interface GameBetGroupProps {
  bets: APIBet[];
  onToggleParlay?: (id: string) => void;
  parlayBetIds: Set<string>;
  onShowExplainer?: (bet: APIBet) => void;
}

export const GameBetGroup = memo(function GameBetGroup({
  bets,
  onToggleParlay,
  parlayBetIds,
  onShowExplainer,
}: GameBetGroupProps) {
  const gameId = bets[0]?.game_id;
  const { getLayout, toggleSection } = useSectionLayout();

  const layout = getLayout(gameId) ?? [];
  const isExpanded = layout.includes(MORE_MARKETS_SECTION);

  const mainlineBets = bets.filter((b) => isMainlineMarket(b.market_key));
  const extraBets = bets.filter((b) => !isMainlineMarket(b.market_key));
  const hasExtra = extraBets.length > 0;

  // Show mainlines by default; fall back to all bets if there are no mainlines
  const visibleBets = isExpanded || !hasExtra
    ? bets
    : mainlineBets.length > 0
      ? mainlineBets
      : bets;

  return (
    <div data-testid="game-bet-group" className="space-y-2">
      {visibleBets.map((bet) => {
        const id = betId(bet);
        return (
          <BetCard
            key={id}
            bet={bet}
            onToggleParlay={onToggleParlay}
            isInParlay={parlayBetIds.has(id)}
            onShowExplainer={onShowExplainer}
          />
        );
      })}
      {hasExtra && (
        <button
          data-testid="more-markets-toggle"
          onClick={() => toggleSection(gameId, MORE_MARKETS_SECTION, [])}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg w-full transition",
          )}
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            color: "var(--ds-text-tertiary)",
            border: "1px solid var(--fb-border-subtle)",
          }}
        >
          <svg
            className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded
            ? `Hide extra markets (${extraBets.length})`
            : `More Markets (${extraBets.length})`}
        </button>
      )}
    </div>
  );
});

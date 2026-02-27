"use client";

import { useState, useCallback } from "react";
import { useFairBetOdds } from "@/hooks/useFairBetOdds";
import { BetCard } from "@/components/fairbet/BetCard";
import { BookFilters } from "@/components/fairbet/BookFilters";
import { FairExplainerSheet } from "@/components/fairbet/FairExplainerSheet";
import { ParlaySheet } from "@/components/fairbet/ParlaySheet";
import { FairBetTheme } from "@/lib/theme";
import type { APIBet } from "@/lib/types";
import { betId, formatEV } from "@/lib/fairbet-utils";

export default function FairBetPage() {
  const hook = useFairBetOdds();
  const [explainerBet, setExplainerBet] = useState<APIBet | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showParlay, setShowParlay] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const openExplainer = useCallback((bet: APIBet) => {
    setExplainerBet(bet);
    setShowExplainer(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
    setExplainerBet(null);
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="px-4 py-4 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">FairBet</h1>
            {hook.canShowParlay && (
              <button
                onClick={() => setShowParlay(true)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${FairBetTheme.info}20`,
                  color: FairBetTheme.info,
                  border: `1px solid ${FairBetTheme.info}40`,
                }}
              >
                Parlay ({hook.parlayCount})
              </button>
            )}
          </div>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="text-xs border rounded-full px-3 py-1 transition"
            style={{
              color: "rgba(255,255,255,0.5)",
              borderColor: FairBetTheme.borderSubtle,
            }}
          >
            How it works
          </button>
        </div>

        {/* ── Filters ── */}
        <BookFilters
          availableLeagues={hook.availableLeagues}
          selectedLeague={hook.filters.league}
          onLeagueChange={hook.setLeague}
          availableMarkets={hook.availableMarkets}
          selectedMarket={hook.filters.market}
          onMarketChange={hook.setMarket}
          searchText={hook.filters.searchText}
          onSearchChange={hook.setSearchText}
          sort={hook.filters.sort}
          onSortChange={hook.setSort}
          evOnly={hook.filters.evOnly}
          onEvOnlyChange={hook.setEvOnly}
          hideThin={hook.filters.hideThin}
          onHideThinChange={hook.setHideThin}
          parlayCount={hook.parlayCount}
          onParlayClick={() => setShowParlay(true)}
          onRefresh={hook.refetch}
        />

        {/* ── Stats row ── */}
        {!hook.loading && !hook.error && (
          <div className="flex items-center gap-3 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span>{hook.filteredTotalCount} bets</span>
            <span>&middot;</span>
            <span>{hook.filteredPositiveEVCount} +EV</span>
            {hook.bestEVAvailable > 0 && (
              <>
                <span>&middot;</span>
                <span>Best: <span style={{ color: FairBetTheme.positive }}>{formatEV(hook.bestEVAvailable)}</span></span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4 space-y-3">
        {/* Loading state */}
        {hook.loading && (
          <div className="py-12 space-y-4">
            <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {hook.loadingProgress || "Loading bets..."}
            </div>
            {/* Animated progress bar */}
            <div className="mx-auto w-48 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: FairBetTheme.surfaceSecondary }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(hook.loadingFraction * 100, 10)}%`,
                  backgroundColor: FairBetTheme.info,
                }}
              />
            </div>
            {/* Skeleton cards */}
            <div className="space-y-3 mt-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="rounded-[14px] h-28 skeleton-shimmer"
                  style={{ backgroundColor: FairBetTheme.surfaceSecondary }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {hook.error && (
          <div className="py-12 text-center space-y-3">
            <div className="text-sm" style={{ color: FairBetTheme.negative }}>
              {hook.error}
            </div>
            <button
              onClick={hook.refetch}
              className="text-xs font-medium px-4 py-1.5 rounded-lg"
              style={{
                backgroundColor: FairBetTheme.surfaceSecondary,
                color: "rgba(255,255,255,0.7)",
                border: `1px solid ${FairBetTheme.borderSubtle}`,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hook.loading && !hook.error && hook.filteredBets.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {hook.filters.evOnly
              ? "No +EV bets found with current filters. Try disabling the +EV filter."
              : "No bets available right now. Try refreshing or changing filters."}
          </div>
        )}

        {/* Bet cards */}
        {!hook.loading &&
          hook.filteredBets.map((bet) => {
            const id = betId(bet);
            return (
              <BetCard
                key={id}
                bet={bet}
                onToggleParlay={hook.toggleParlay}
                isInParlay={hook.parlayBetIds.has(id)}
                onShowExplainer={openExplainer}
              />
            );
          })}

        {/* Loading more indicator */}
        {hook.isLoadingMore && (
          <div className="py-4 text-center space-y-2">
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {hook.loadingProgress}
            </div>
            <div className="mx-auto w-32 h-1 rounded-full overflow-hidden" style={{ backgroundColor: FairBetTheme.surfaceSecondary }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${hook.loadingFraction * 100}%`,
                  backgroundColor: FairBetTheme.info,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      <FairExplainerSheet
        open={showExplainer}
        onClose={closeExplainer}
        bet={explainerBet}
      />

      <ParlaySheet
        open={showParlay}
        onClose={() => setShowParlay(false)}
        parlayBets={hook.parlayBets}
        parlayOdds={hook.parlayFairAmericanOdds}
        parlayProbability={hook.parlayFairProbability}
        parlayConfidence={hook.parlayConfidence}
        onRemoveLeg={hook.toggleParlay}
        onClearAll={hook.clearParlay}
      />

      {/* How it works - generic sheet */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHowItWorks(false)} />
          <div
            className="relative z-10 w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 space-y-4"
            style={{
              backgroundColor: FairBetTheme.cardBackground,
              border: `1px solid ${FairBetTheme.borderSubtle}`,
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">How FairBet Works</h2>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="text-sm space-y-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              <p>
                FairBet calculates the <strong className="text-white">true probability</strong> of each
                outcome by removing the sportsbook&apos;s margin (vig) from sharp
                lines.
              </p>
              <p>
                A bet has <strong className="text-white">positive expected value (+EV)</strong> when a
                book&apos;s price implies a lower probability than the true
                probability. This means the payout exceeds what the risk
                warrants.
              </p>
              <p>
                <span style={{ color: FairBetTheme.positive }} className="font-medium">Green values</span>{" "}
                indicate +EV prices.{" "}
                <span style={{ color: FairBetTheme.info }} className="font-medium">Blue rings</span>{" "}
                indicate sharp (reference) books.
              </p>
              <p>
                Use the <strong className="text-white">parlay builder</strong> to combine multiple +EV bets.
                Fair probability for parlays assumes independent legs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

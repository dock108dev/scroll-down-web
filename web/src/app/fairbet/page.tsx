"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useFairBetOdds } from "@/hooks/useFairBetOdds";
import { GameBetGroup } from "@/components/fairbet/GameBetGroup";
import { BetCard } from "@/components/fairbet/BetCard";
import { betId } from "@/lib/fairbet-utils";
import { BookFilters } from "@/components/fairbet/BookFilters";
import { FairExplainerSheet } from "@/components/fairbet/FairExplainerSheet";
import { ParlaySheet } from "@/components/fairbet/ParlaySheet";
import { LiveOddsPanel } from "@/components/fairbet/LiveOddsPanel";
import { FairBetTheme } from "@/lib/theme";
import type { APIBet } from "@/lib/types";
import { Spinner } from "@/components/shared/Spinner";
import { StaleBanner } from "@/components/shared/StaleBanner";
import { InlineFeedback } from "@/components/shared/InlineFeedback";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { RENDER } from "@/lib/config";
import { AdvancedFilters } from "@/components/fairbet/AdvancedFilters";

export default function FairBetPage() {
  const hook = useFairBetOdds();
  const [explainerBet, setExplainerBet] = useState<APIBet | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showParlay, setShowParlay] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [activeTab, setActiveTab] = useState<"pregame" | "live">("pregame");
  const { retryCount, manualRetry } = useAutoRetry({ error: hook.error, loading: hook.loading, refetch: hook.refetch });

  // Show "taking longer than expected" after 3s of loading
  const [loadingSlowFlag, setLoadingSlowFlag] = useState(false);
  const loadingSlow = hook.loading && !hook.error && loadingSlowFlag;
  // Force timeout after 15s of loading with no error — prevents perpetual spinner
  const [loadingTimedOutFlag, setLoadingTimedOutFlag] = useState(false);
  const loadingTimedOut = loadingTimedOutFlag && hook.loading && !hook.error;
  useEffect(() => {
    if (!hook.loading || hook.error) return;
    const slowTimer = setTimeout(() => setLoadingSlowFlag(true), 3_000);
    const timeoutTimer = setTimeout(() => setLoadingTimedOutFlag(true), 15_000);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      setLoadingSlowFlag(false);
      setLoadingTimedOutFlag(false);
    };
  }, [hook.loading, hook.error]);

  // Group filtered bets by game_id (order preserved by first occurrence)
  const gameGroups = useMemo(() => {
    const map = new Map<number, APIBet[]>();
    for (const bet of hook.filteredBets) {
      const group = map.get(bet.game_id) ?? [];
      group.push(bet);
      map.set(bet.game_id, group);
    }
    return [...map.values()];
  }, [hook.filteredBets]);

  // Progressive rendering — reset visible count when filters change
  const [visibleCount, setVisibleCount] = useState(RENDER.FAIRBET_BATCH);
  const [prevFilters, setPrevFilters] = useState(hook.filters);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (prevFilters !== hook.filters) {
    setPrevFilters(hook.filters);
    setVisibleCount(RENDER.FAIRBET_BATCH);
  }

  // IntersectionObserver to load more game groups on scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + RENDER.FAIRBET_BATCH);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gameGroups.length]);

  const openExplainer = useCallback((bet: APIBet) => {
    setExplainerBet(bet);
    setShowExplainer(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
    setExplainerBet(null);
  }, []);

  return (
    <div data-testid="page-fairbet" className="mx-auto max-w-5xl">
      <div className="sticky z-30 bg-neutral-950 px-4 py-2 sm:py-3 space-y-2 sm:space-y-2.5 border-b border-neutral-800/50" style={{ top: "var(--header-h)" }}>
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-neutral-50">FairBet</h1>
            <p className="text-[11px] sm:text-xs text-neutral-500 leading-snug">
              Find better prices across sportsbooks.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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
            <button
              onClick={() => setShowHowItWorks(true)}
              className="text-[11px] font-medium rounded-full px-2.5 py-1.5 min-h-[36px] sm:min-h-[32px] transition"
              style={{
                backgroundColor: "var(--fb-info-soft)",
                color: "var(--fb-info)",
                border: "1px solid var(--fb-info)30",
              }}
            >
              How FairBet works
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div role="tablist" aria-label="FairBet odds timing" className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--fb-surface-secondary)" }}>
          {(["pregame", "live"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}

              className="flex-1 text-xs font-semibold py-2.5 min-h-[44px] rounded-md transition-colors capitalize text-center whitespace-nowrap"

              style={{
                backgroundColor: activeTab === tab ? "var(--fb-card-bg)" : "transparent",
                color: activeTab === tab ? "var(--ds-text-primary)" : "var(--ds-text-tertiary)",
                boxShadow: activeTab === tab ? "var(--ds-shadow-subtle)" : "none",
              }}
            >
              {tab === "pregame" ? "Pre-Game" : "In-Game"}
            </button>
          ))}
        </div>

        {/* ── Filters (pregame only, hidden when error with no data) ── */}
        {activeTab === "pregame" && !(hook.error && hook.filteredBets.length === 0) && (
          <>
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
              parlayCount={hook.parlayCount}
              onParlayClick={() => setShowParlay(true)}
              onRefresh={hook.refetch}
              disabled={!!hook.error || (hook.filteredBets.length === 0 && !hook.loading)}
            />
            <AdvancedFilters
              filters={hook.filters}
              onConfidenceChange={hook.setConfidence}
              onTimeToGameChange={hook.setTimeToGame}
              onEvOnlyChange={hook.setEvOnly}
              onHideThinChange={hook.setHideThin}
              onHideAltsChange={hook.setHideAlts}
              disabled={!!hook.error || (hook.filteredBets.length === 0 && !hook.loading)}
            />
          </>
        )}

      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4 space-y-3">
        {activeTab === "live" && <div role="tabpanel" id="tabpanel-live" aria-labelledby="tab-live"><LiveOddsPanel /></div>}

        {activeTab === "pregame" && <div role="tabpanel" id="tabpanel-pregame" aria-labelledby="tab-pregame">
        <StaleBanner stale={hook.stale} staleAt={hook.staleAt} onRetry={hook.refetch} />

        {/* Loading state — skeleton cards to avoid blank screen */}
        {hook.loading && !hook.error && !loadingTimedOut && (
          <div className="pt-3 space-y-3">
            <LoadingSkeleton variant="fairbetCard" count={4} />
            {loadingSlow && (
              <p className="text-xs text-neutral-600 text-center pt-1">Taking longer than expected… We&apos;ll show an error if it doesn&apos;t connect.</p>
            )}
          </div>
        )}

        {/* Error state (includes loading timeout) */}
        {(hook.error || loadingTimedOut) && (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-neutral-400">
              {retryCount >= 3
                ? "The service may be temporarily unavailable."
                : "We\u2019re having trouble loading odds right now."}
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
              FairBet compares odds across sportsbooks to find bets where the
              price is better than the true probability — giving you an edge.
            </p>
            <button
              onClick={manualRetry}
              disabled={hook.loading}
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg text-neutral-200 disabled:opacity-50"
              style={{
                backgroundColor: "var(--fb-surface-secondary)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            >
              {hook.loading ? <><Spinner size={14} /> Retrying…</> : "Retry"}
            </button>
            <p className="text-xs text-neutral-600">
              {retryCount >= 3
                ? "Automatic retries exhausted. You can still retry manually."
                : retryCount > 0
                  ? "Retrying automatically…"
                  : "Odds will appear here once the connection is restored."}
            </p>
            <button
              onClick={() => setShowHowItWorks(true)}
              className="mt-2 text-xs font-medium px-4 py-2 min-h-[44px] rounded-lg transition"
              style={{
                backgroundColor: "var(--fb-info-soft)",
                color: "var(--fb-info)",
                border: "1px solid var(--fb-info)40",
              }}
            >
              Learn how FairBet works &rarr;
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hook.loading && !hook.error && hook.filteredBets.length === 0 && (
          <div data-testid="fairbet-empty-state" className="py-12 text-center space-y-3">
            <p className="text-base font-semibold text-neutral-300">
              No strong edges right now.
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
              Check back closer to game time or broaden your filters.
            </p>
            <div className="flex flex-col items-center gap-2 pt-1">
              {hook.filters.evOnly && (
                <button
                  onClick={() => hook.setEvOnly(false)}
                  className="text-xs font-medium px-4 py-2 min-h-[40px] rounded-lg transition"
                  style={{
                    backgroundColor: "var(--fb-surface-secondary)",
                    color: "var(--ds-text-secondary)",
                    border: "1px solid var(--fb-border-subtle)",
                  }}
                >
                  Show all bets
                </button>
              )}
              {hook.filters.hideThin && (
                <button
                  onClick={() => hook.setHideThin(false)}
                  className="text-xs font-medium px-4 py-2 min-h-[40px] rounded-lg transition"
                  style={{
                    backgroundColor: "var(--fb-surface-secondary)",
                    color: "var(--ds-text-secondary)",
                    border: "1px solid var(--fb-border-subtle)",
                  }}
                >
                  Include thin markets
                </button>
              )}
              <button
                onClick={hook.refetch}
                className="text-xs font-medium px-4 py-2 min-h-[40px] rounded-lg transition"
                style={{
                  backgroundColor: "var(--fb-surface-secondary)",
                  color: "var(--ds-text-tertiary)",
                  border: "1px solid var(--fb-border-subtle)",
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Render: Best-EV is a flat global sort. Other sorts group by game. */}
        {!hook.loading && hook.filters.sort === "bestEV" &&
          hook.filteredBets.slice(0, visibleCount).map((bet) => {
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

        {!hook.loading && hook.filters.sort !== "bestEV" &&
          gameGroups.slice(0, visibleCount).map((bets) => (
            <GameBetGroup
              key={bets[0].game_id}
              bets={bets}
              onToggleParlay={hook.toggleParlay}
              parlayBetIds={hook.parlayBetIds}
              onShowExplainer={openExplainer}
            />
          ))}

        {/* Sentinel for loading more + count indicator */}
        {!hook.loading && (
          hook.filters.sort === "bestEV"
            ? visibleCount < hook.filteredBets.length
            : visibleCount < gameGroups.length
        ) && (
          <>
            <div ref={sentinelRef} className="h-px" />
            <div className="text-center text-xs text-neutral-500 py-2">
              {hook.filters.sort === "bestEV"
                ? `Showing ${Math.min(visibleCount, hook.filteredBets.length)} of ${hook.filteredBets.length} bets`
                : `Showing ${Math.min(visibleCount, gameGroups.length)} of ${gameGroups.length} games`}
            </div>
          </>
        )}

        {/* Loading more indicator */}
        {hook.isLoadingMore && (
          <div className="py-4 text-center space-y-2">
            <div className="text-xs text-neutral-500">
              {hook.loadingProgress}
            </div>
            <div className="mx-auto w-32 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--fb-surface-secondary)" }}>
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
        </div>}
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
        parlayCorrelated={hook.parlayCorrelated}
        staleBetIds={hook.staleBetIds}
        onRemoveLeg={hook.toggleParlay}
        onClearAll={hook.clearParlay}
      />

      {/* How FairBet works */}
      {showHowItWorks && (
        <div
          data-testid="fairbet-how-modal"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHowItWorks(false)} />
          <div
            className="relative z-10 w-full max-w-md rounded-t-2xl md:rounded-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--fb-card-bg)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-50">How FairBet works</h2>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                aria-label="Close"
                className="shrink-0 rounded-lg flex items-center justify-center hover:bg-neutral-800 transition-colors"
                style={{ width: "44px", height: "44px", color: "var(--color-neutral-300, #d4d4d4)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="text-sm space-y-3 text-neutral-400 leading-relaxed">
              <p>
                FairBet compares prices across sportsbooks and estimates a fair
                price using the available market. When one sportsbook offers a
                better price than the estimate, we flag it as a possible edge.
              </p>
              <p className="text-xs text-neutral-500">
                These are estimates, not guarantees.
              </p>
            </div>
          </div>
        </div>
      )}
      {!hook.error && !hook.loading && hook.allBets.length > 0 && <InlineFeedback context="fairbet" />}
    </div>
  );
}

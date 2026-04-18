"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useFairBetOdds } from "@/hooks/useFairBetOdds";
import { GameBetGroup } from "@/components/fairbet/GameBetGroup";
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-neutral-50">FairBet</h1>
            <span className="hidden sm:inline text-xs text-neutral-500">Compare odds &middot; Find +EV</span>
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
            className="text-[11px] font-medium rounded-full px-2.5 py-1.5 min-h-[36px] sm:min-h-[32px] transition"
            style={{
              backgroundColor: "var(--fb-info-soft)",
              color: "var(--fb-info)",
              border: "1px solid var(--fb-info)30",
            }}
          >
            How it works
          </button>
        </div>

        {/* ── Brief description ── */}
        <p className="text-[11px] text-neutral-500 leading-snug -mt-0.5">
          Compares odds across sportsbooks to find bets where the price is
          better than the true probability.
        </p>

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
        {activeTab === "pregame" && !(hook.error && hook.filteredBets.length === 0) && <BookFilters
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
          disabled={!!hook.error || (hook.filteredBets.length === 0 && !hook.loading)}
        />}

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
          <div data-testid="fairbet-empty-state" className="py-12 text-center space-y-4">
            <p className="text-base font-semibold text-neutral-300">
              {hook.allBets.length > 0 && !hook.filters.evOnly
                ? "No bets match your filters"
                : "Markets are tight today"}
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
              {hook.allBets.length > 0 && !hook.filters.evOnly
                ? "Try clearing your filters to see all available odds."
                : hook.filters.evOnly && hook.allBets.length > 0
                  ? "No +EV opportunities at the moment. Try disabling the +EV filter to browse all odds."
                  : "No edges found across tracked markets. Check back closer to game time."}
            </p>
            <div className="flex flex-col items-center gap-3 pt-1">
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
              <button
                onClick={hook.refetch}
                className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 min-h-[40px] rounded-lg transition"
                style={{
                  backgroundColor: "var(--fb-surface-secondary)",
                  color: "var(--ds-text-tertiary)",
                  border: "1px solid var(--fb-border-subtle)",
                }}
              >
                Refresh
              </button>
            </div>

            {/* Example card — only shown when API returned no odds at all */}
            {hook.allBets.length === 0 && (
              <div className="mx-auto max-w-sm text-left rounded-xl p-4 space-y-3 opacity-60 pointer-events-none select-none" style={{ backgroundColor: "var(--fb-card-bg)", border: "1px dashed var(--fb-border-subtle)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Example</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-200">Lakers vs Celtics</p>
                    <p className="text-xs text-neutral-500">Spread &middot; NBA</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${FairBetTheme.positive}20`, color: FairBetTheme.positive }}>+2.4% EV</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-neutral-400">Fair: <strong className="text-neutral-200">-108</strong></span>
                  <span className="text-neutral-400">Best: <strong style={{ color: FairBetTheme.positive }}>-102</strong></span>
                  <span className="text-neutral-500 ml-auto">DraftKings</span>
                </div>
                <p className="text-[10px] text-neutral-600 leading-relaxed">
                  &uarr; When a book&apos;s price is better than the fair line, you have an edge.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bet groups (one per game, mainlines shown by default) */}
        {!hook.loading &&
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
        {!hook.loading && visibleCount < gameGroups.length && (
          <>
            <div ref={sentinelRef} className="h-px" />
            <div className="text-center text-xs text-neutral-500 py-2">
              Showing {Math.min(visibleCount, gameGroups.length)} of{" "}
              {gameGroups.length} games
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

      {/* How it works - generic sheet */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHowItWorks(false)} />
          <div
            className="relative z-10 w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--fb-card-bg)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-50">How FairBet Works</h2>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-neutral-500 hover:text-neutral-50 text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                Close
              </button>
            </div>
            <div className="text-sm space-y-3 text-neutral-400">
              <p>
                FairBet calculates the{" "}
                <span className="relative inline-block group">
                  <strong className="text-neutral-50 underline decoration-dotted decoration-neutral-600 cursor-help">true probability</strong>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    What should actually happen, minus the book&apos;s cut.
                  </span>
                </span>
                {" "}of each outcome by removing the sportsbook&apos;s margin (vig) from sharp
                lines.
              </p>
              <p>
                A bet has{" "}
                <span className="relative inline-block group">
                  <strong className="text-neutral-50 underline decoration-dotted decoration-neutral-600 cursor-help">positive expected value (+EV)</strong>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    The price is better than it should be. Profitable long term.
                  </span>
                </span>
                {" "}when a book&apos;s price implies a lower probability than the true
                probability. This means the payout exceeds what the risk
                warrants.
              </p>
              <p>
                <span style={{ color: FairBetTheme.positive }} className="font-medium">Green values</span>{" "}
                indicate +EV prices.
              </p>
              <p>
                Use the{" "}
                <span className="relative inline-block group">
                  <strong className="text-neutral-50 underline decoration-dotted decoration-neutral-600 cursor-help">parlay builder</strong>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    Combine multiple bets into one. Higher risk, higher payout.
                  </span>
                </span>
                {" "}to combine multiple +EV bets.
                Fair probability for parlays assumes independent legs.
              </p>
            </div>

            {/* Real talk */}
            <div className="border-t border-neutral-800 pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-yellow-500/80 uppercase tracking-wide">
                Real talk on EV
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Positive expected value doesn&apos;t mean the bet is going to hit. It
                just means the number is off. That&apos;s it. If math and probability
                aren&apos;t really your thing, this probably isn&apos;t going to be the
                magic switch that fixes everything.
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Now, if it <span className="italic">is</span> working and
                we&apos;re consistently
                beating{" "}
                <span className="relative inline-block group">
                  <span className="underline decoration-dotted decoration-neutral-600 cursor-help">
                    closing line value
                  </span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[200px] rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    How much better our bet was compared to the closing line.
                  </span>
                </span>
                , first of all: nice. Second of all: enjoy it while it lasts.
                Because every American sportsbook on earth will limit your account
                the second they catch on. Trust us. Shoutout to the $4 max bets on
                basically every major book in the country. And if you don&apos;t
                know what CLV is... honestly, maybe just watch the games.
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Once we do get limited, the next move is{" "}
                <span className="relative inline-block group">
                  <span className="underline decoration-dotted decoration-neutral-600 cursor-help">
                    peer-to-peer exchanges
                  </span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[200px] rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    Bet against people not books. No limits but you post a price or find one you like if it exists.
                  </span>
                </span>
                , not books. No limits, but we&apos;re either posting a price or
                finding one we like if it exists. They&apos;re not available
                everywhere, but that&apos;s where you go if you want to keep
                pressing after stacking some cash. And again, if you don&apos;t
                know what those are, you probably shouldn&apos;t be trying this yet
                either.
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Peer-to-peer exchange tracking and odds comparison tools are on
                the roadmap.
              </p>
            </div>
          </div>
        </div>
      )}
      {!hook.error && !hook.loading && hook.allBets.length > 0 && <InlineFeedback context="fairbet" />}
    </div>
  );
}

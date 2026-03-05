"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useFairBetOdds } from "@/hooks/useFairBetOdds";
import { BetCard } from "@/components/fairbet/BetCard";
import { BookFilters } from "@/components/fairbet/BookFilters";
import { FairExplainerSheet } from "@/components/fairbet/FairExplainerSheet";
import { ParlaySheet } from "@/components/fairbet/ParlaySheet";
import { LiveOddsPanel } from "@/components/fairbet/LiveOddsPanel";
import { FairBetTheme } from "@/lib/theme";
import type { APIBet } from "@/lib/types";
import { betId } from "@/lib/fairbet-utils";
import { RENDER, REALTIME } from "@/lib/config";
import { useGameData } from "@/stores/game-data";

export default function FairBetPage() {
  const hook = useFairBetOdds();
  const connected = useGameData((s) => s.realtimeStatus.connected);
  const lastEventAt = useGameData((s) => s.realtimeStatus.lastEventAt);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), REALTIME.FRESHNESS_INDICATOR_MS);
    return () => clearInterval(iv);
  }, []);
  const isRealtimeFresh = connected && now - lastEventAt < REALTIME.FRESHNESS_INDICATOR_MS;
  const [explainerBet, setExplainerBet] = useState<APIBet | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showParlay, setShowParlay] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [activeTab, setActiveTab] = useState<"pregame" | "live">("pregame");

  // Progressive rendering — reset visible count when filters change
  const [visibleCount, setVisibleCount] = useState(RENDER.FAIRBET_BATCH);
  const [prevFilters, setPrevFilters] = useState(hook.filters);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (prevFilters !== hook.filters) {
    setPrevFilters(hook.filters);
    setVisibleCount(RENDER.FAIRBET_BATCH);
  }

  // IntersectionObserver to load more cards on scroll
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
  }, [hook.filteredBets.length]);

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
            <h1 className="text-xl font-bold text-neutral-50">FairBet</h1>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: isRealtimeFresh ? "#22c55e" : "#6b7280" }}
              title={isRealtimeFresh ? "Live" : "Offline"}
            />
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
            className="text-xs font-medium rounded-full px-3 py-1 transition"
            style={{
              backgroundColor: "var(--fb-info-soft)",
              color: "var(--fb-info)",
              border: "1px solid var(--fb-info)30",
            }}
          >
            What is this?
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--fb-surface-secondary)" }}>
          {(["pregame", "live"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors capitalize"
              style={{
                backgroundColor: activeTab === tab ? "var(--fb-card-bg)" : "transparent",
                color: activeTab === tab ? "var(--ds-text-primary)" : "var(--ds-text-tertiary)",
                boxShadow: activeTab === tab ? "var(--ds-shadow-subtle)" : "none",
              }}
            >
              {tab === "pregame" ? "Pre-Game" : "Live"}
            </button>
          ))}
        </div>

        {/* ── Filters (pregame only) ── */}
        {activeTab === "pregame" && <BookFilters
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
        />}

      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4 space-y-3">
        {activeTab === "live" && <LiveOddsPanel />}

        {activeTab === "pregame" && <>
        {/* Loading state */}
        {hook.loading && (
          <div className="py-12 space-y-4">
            <div className="text-center text-sm text-neutral-500">
              Loading bets...
            </div>
            {/* Indeterminate shimmer bar */}
            <div className="mx-auto w-48 h-1.5 rounded-full overflow-hidden skeleton-shimmer" style={{ backgroundColor: "var(--fb-surface-secondary)" }} />
            {/* Skeleton cards */}
            <div className="space-y-3 mt-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="rounded-[14px] h-28 skeleton-shimmer"
                  style={{ backgroundColor: "var(--fb-surface-secondary)" }}
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
              className="text-xs font-medium px-4 py-1.5 rounded-lg text-neutral-400"
              style={{
                backgroundColor: "var(--fb-surface-secondary)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hook.loading && !hook.error && hook.filteredBets.length === 0 && (
          <div className="py-12 text-center text-sm text-neutral-500">
            {hook.filters.evOnly
              ? "No +EV bets found with current filters. Try disabling the +EV filter."
              : "No bets available right now. Try refreshing or changing filters."}
          </div>
        )}

        {/* Bet cards */}
        {!hook.loading &&
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

        {/* Sentinel for loading more + count indicator */}
        {!hook.loading && visibleCount < hook.filteredBets.length && (
          <>
            <div ref={sentinelRef} className="h-px" />
            <div className="text-center text-xs text-neutral-500 py-2">
              Showing {Math.min(visibleCount, hook.filteredBets.length)} of{" "}
              {hook.filteredBets.length}
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
        </>}
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
                className="text-neutral-500 hover:text-neutral-50 text-sm"
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
                Tracking and odds comps for p2p coming soon... maybe &#128064;&#129300;&#10071;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

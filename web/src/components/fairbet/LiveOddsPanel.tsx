"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFairBetLive } from "@/hooks/useFairBetLive";
import type { LiveGameData } from "@/hooks/useFairBetLive";
import { useHealthDegraded } from "@/hooks/useHealthStatus";
import { BetCard } from "@/components/fairbet/BetCard";
import { FairExplainerSheet } from "@/components/fairbet/FairExplainerSheet";
import { LeagueBadge } from "@/components/fairbet/LeagueBadge";
import { FairBetTheme } from "@/lib/theme";
import { betId } from "@/lib/fairbet-utils";
import { RENDER } from "@/lib/config";
import type { APIBet } from "@/lib/types";

const MARKET_FILTERS = [
  { key: "", label: "All" },
  { key: "mainline", label: "Mainline" },
  { key: "player_prop", label: "Player Props" },
  { key: "team_prop", label: "Team Props" },
] as const;

const SORT_OPTIONS = [
  { key: "ev", label: "Best EV" },
  { key: "market", label: "Market" },
] as const;

export function LiveOddsPanel() {
  const hook = useFairBetLive();
  const isDegraded = useHealthDegraded();
  const [explainerBet, setExplainerBet] = useState<APIBet | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  // Progressive rendering
  const totalBets = hook.allBets.length;
  const prevTotalRef = useRef(totalBets);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(RENDER.FAIRBET_BATCH);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Reset if total changed since last observation
          if (prevTotalRef.current !== totalBets) {
            prevTotalRef.current = totalBets;
            setVisibleCount(RENDER.FAIRBET_BATCH);
            return;
          }
          setVisibleCount((c) => c + RENDER.FAIRBET_BATCH);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalBets]);

  const openExplainer = useCallback((bet: APIBet) => {
    setExplainerBet(bet);
    setShowExplainer(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
    setExplainerBet(null);
  }, []);

  const hasData = hook.gameData.length > 0;
  const showFilters = hasData || hook.gamesLoading || hook.loading;

  return (
    <div data-testid="live-odds-panel" className="space-y-3">
      {/* ── Filters (hidden when no live games and not loading) ── */}
      {showFilters && <div className="space-y-2">
        {/* League pills + refresh */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <FilterPill
            label="All"
            active={hook.league === ""}
            onClick={() => hook.setLeague("")}
          />
          {hook.availableLeagues.map((lc) => (
            <FilterPill
              key={lc}
              label={lc}
              active={hook.league === lc}
              onClick={() => hook.setLeague(lc)}
            />
          ))}

          <div className="flex-1" />

          <button
            onClick={hook.refetch}
            className="shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-300 transition"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }}
            title="Refresh"
            aria-label="Refresh in-game odds"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M4 4v5h5M20 20v-5h-5" />
              <path d="M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
            </svg>
          </button>
        </div>

        {/* Market + toggle pills row */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {MARKET_FILTERS.filter(
            (mf) =>
              mf.key === "" || hook.availableMarkets.includes(mf.key),
          ).map((mf) => (
            <FilterPill
              key={mf.key || "all-market"}
              label={mf.label}
              active={hook.marketCategory === mf.key}
              onClick={() => hook.setMarketCategory(mf.key)}
            />
          ))}

          <Separator />

          <TogglePill
            label="+EV Only"
            active={hook.evOnly}
            onClick={() => hook.setEvOnly(!hook.evOnly)}
          />
          <TogglePill
            label="Hide Thin"
            active={hook.hideThin}
            onClick={() => hook.setHideThin(!hook.hideThin)}
          />
          <TogglePill
            label="Hide Alts"
            active={hook.hideAlternates}
            onClick={() => hook.setHideAlternates(!hook.hideAlternates)}
          />
        </div>

        {/* Search + sort + live indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search teams, players..."
              value={hook.searchText}
              onChange={(e) => hook.setSearchText(e.target.value)}
              className="w-full rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
              style={{
                backgroundColor: "var(--fb-surface-secondary)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            />
            {hook.searchText && (
              <button
                onClick={() => hook.setSearchText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 text-xs"
              >
                x
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={hook.sortBy}
            onChange={(e) => hook.setSortBy(e.target.value)}
            className="shrink-0 text-xs rounded-lg px-2 py-1.5 bg-[var(--fb-surface-secondary)] text-neutral-400 border border-[var(--fb-border-subtle)] outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Live indicator */}
          {hasData && (
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              Live
            </div>
          )}
        </div>
      </div>}

      {/* ── States ───────────────────────────────────────── */}
      {(hook.gamesLoading || hook.loading) && !hasData && (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="text-sm text-neutral-500">Discovering live games…</div>
          <div
            className="w-48 h-1.5 rounded-full overflow-hidden skeleton-shimmer"
            style={{ backgroundColor: "var(--fb-surface-secondary)" }}
          />
        </div>
      )}

      {hook.error && !hasData && (
        <div className="py-12 text-center space-y-4">
          <p className="text-sm text-neutral-400">We&apos;re having trouble loading in-game odds right now.</p>
          <button
            onClick={hook.refetch}
            disabled={hook.loading || hook.gamesLoading}
            className="text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg text-neutral-200 disabled:opacity-50"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          >
            {hook.loading || hook.gamesLoading ? "Retrying…" : "Retry"}
          </button>
          <p className="text-xs text-neutral-600">In-game odds are available when live games are in progress.</p>
        </div>
      )}

      {!hook.gamesLoading && !hook.loading && hook.liveGames.length === 0 && (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-neutral-400">
            {isDegraded
              ? "Can\u2019t check for live games right now \u2014 the server is temporarily unreachable."
              : "No live games with in-game odds right now."}
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
            {isDegraded
              ? "In-game odds will appear here once the connection is restored and games are in progress."
              : "In-game odds appear here when games are in progress. Check the Pre-Game tab for upcoming bets."}
          </p>
          {isDegraded && (
            <button
              onClick={hook.refetch}
              className="text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg text-neutral-200"
              style={{
                backgroundColor: "var(--fb-surface-secondary)",
                border: "1px solid var(--fb-border-subtle)",
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Game groups ──────────────────────────────────── */}
      {hook.gameData.map((gd) => (
        <GameGroup
          key={gd.game.game_id}
          data={gd}
          visibleCount={visibleCount}
          onShowExplainer={openExplainer}
          onToggleParlay={hook.toggleParlay}
          parlayIds={hook.parlayBetIds}
        />
      ))}

      {/* Sentinel for infinite scroll */}
      {!hook.loading && visibleCount < totalBets && (
        <>
          <div ref={sentinelRef} className="h-px" />
          <div className="text-center text-xs text-neutral-500 py-2">
            Showing {Math.min(visibleCount, totalBets)} of {totalBets}
          </div>
        </>
      )}

      {/* Empty after filtering */}
      {!hook.loading &&
        !hook.gamesLoading &&
        hook.liveGames.length > 0 &&
        totalBets === 0 && (
          <div className="py-8 text-center text-sm text-neutral-500">
            {hook.evOnly
              ? "No +EV bets found. Try disabling the +EV filter."
              : "No bets match current filters."}
          </div>
        )}

      {/* Explainer sheet */}
      <FairExplainerSheet
        open={showExplainer}
        onClose={closeExplainer}
        bet={explainerBet}
      />
    </div>
  );
}

// ── Game group with scoreboard header ─────────────────────

function GameGroup({
  data,
  visibleCount,
  onShowExplainer,
  onToggleParlay,
  parlayIds,
}: {
  data: LiveGameData;
  visibleCount: number;
  onShowExplainer: (bet: APIBet) => void;
  onToggleParlay: (id: string) => void;
  parlayIds: Set<string>;
}) {
  const { game, response, bets } = data;
  if (bets.length === 0) return null;

  const lastUpdate = response.last_updated_at
    ? new Date(response.last_updated_at).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-2">
      {/* Scoreboard header strip */}
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg"
        style={{
          backgroundColor: "var(--fb-surface-secondary)",
          border: "1px solid var(--fb-border-subtle)",
        }}
      >
        <LeagueBadge league={game.league_code} />

        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-neutral-200 truncate">
            {game.away_team} @ {game.home_team}
          </div>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
          </span>
          <span className="text-[10px] font-medium text-green-400 uppercase">
            Live
          </span>
        </div>

        {/* Bet count */}
        <span className="text-[10px] text-neutral-500 shrink-0">
          {bets.length} bet{bets.length !== 1 ? "s" : ""}
        </span>

        {/* Last update */}
        {lastUpdate && (
          <span className="text-[10px] text-neutral-600 shrink-0">
            {lastUpdate}
          </span>
        )}
      </div>

      {/* Bet cards for this game */}
      {bets.slice(0, visibleCount).map((bet) => {
        const id = betId(bet);
        return (
          <BetCard
            key={id}
            bet={bet}
            onShowExplainer={onShowExplainer}
            onToggleParlay={onToggleParlay}
            isInParlay={parlayIds.has(id)}
          />
        );
      })}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-2 min-h-[44px] text-xs font-medium transition whitespace-nowrap"
      style={
        active
          ? { backgroundColor: FairBetTheme.info, color: "#fff" }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }
      }
    >
      {label}
    </button>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-2 min-h-[44px] text-xs font-medium transition"
      style={
        active
          ? {
              backgroundColor: `${FairBetTheme.positive}20`,
              color: FairBetTheme.positive,
              border: `1px solid ${FairBetTheme.positive}40`,
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              color: "var(--ds-text-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }
      }
    >
      {label}
    </button>
  );
}

function Separator() {
  return (
    <div
      className="self-stretch w-px shrink-0 mx-1"
      style={{ backgroundColor: "var(--fb-border-subtle)" }}
    />
  );
}

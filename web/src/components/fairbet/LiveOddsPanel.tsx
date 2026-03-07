"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFairBetLive } from "@/hooks/useFairBetLive";
import { BetCard } from "@/components/fairbet/BetCard";
import { FairExplainerSheet } from "@/components/fairbet/FairExplainerSheet";
import { FairBetTheme } from "@/lib/theme";
import { api } from "@/lib/api";
import { betId } from "@/lib/fairbet-utils";
import { RENDER } from "@/lib/config";
import type { APIBet } from "@/lib/types";

interface LiveGame {
  game_id: number;
  home_team: string;
  away_team: string;
  league: string;
}

const MARKET_FILTERS = [
  { key: "", label: "All" },
  { key: "mainline", label: "Mainline" },
  { key: "player_prop", label: "Player Props" },
  { key: "team_prop", label: "Team Props" },
] as const;

export function LiveOddsPanel() {
  const hook = useFairBetLive();
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [explainerBet, setExplainerBet] = useState<APIBet | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  // Progressive rendering
  const [visibleCount, setVisibleCount] = useState(RENDER.FAIRBET_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  const prevBetsLen = useRef(hook.bets.length);
  if (prevBetsLen.current !== hook.bets.length) {
    prevBetsLen.current = hook.bets.length;
    setVisibleCount(RENDER.FAIRBET_BATCH);
  }

  // IntersectionObserver for infinite scroll
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
  }, [hook.bets.length]);

  // Fetch today's live games for the picker
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const params = new URLSearchParams({
          startDate: today,
          endDate: today,
        });
        const res = await api.games(params);
        const live = (res.games ?? [])
          .filter((g) => g.isLive)
          .map((g) => ({
            game_id: g.id,
            home_team: g.homeTeam ?? "Home",
            away_team: g.awayTeam ?? "Away",
            league: g.leagueCode ?? "",
          }));
        if (!cancelled) {
          setLiveGames(live);
          if (live.length > 0 && hook.gameId === null) {
            hook.setGameId(live[0].game_id);
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openExplainer = useCallback((bet: APIBet) => {
    setExplainerBet(bet);
    setShowExplainer(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
    setExplainerBet(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* Game Picker */}
      <div className="flex flex-wrap gap-2">
        <select
          value={hook.gameId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            hook.setGameId(v ? Number(v) : null);
          }}
          className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2 bg-[var(--fb-surface-secondary)] text-neutral-200 border border-[var(--fb-border-subtle)] outline-none"
        >
          <option value="">
            {gamesLoading
              ? "Loading games..."
              : liveGames.length === 0
                ? "No live games"
                : "Select a game"}
          </option>
          {liveGames.map((g) => (
            <option key={g.game_id} value={g.game_id}>
              {g.away_team} @ {g.home_team} ({g.league})
            </option>
          ))}
        </select>

        <button
          onClick={hook.refetch}
          disabled={hook.gameId === null}
          className="shrink-0 p-2 rounded-lg text-neutral-500 disabled:opacity-40"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: "1px solid var(--fb-border-subtle)",
          }}
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 4v5h5M20 20v-5h-5" />
            <path d="M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
          </svg>
        </button>
      </div>

      {/* Filters (only when game selected and data loaded) */}
      {hook.gameId !== null && hook.data && (
        <div className="space-y-2">
          {/* Market + toggle pills row */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {MARKET_FILTERS.filter(
              (mf) => mf.key === "" || (hook.availableMarkets ?? []).includes(mf.key),
            ).map((mf) => (
              <button
                key={mf.key || "all-market"}
                onClick={() => hook.setMarketCategory(mf.key)}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap"
                style={
                  hook.marketCategory === mf.key
                    ? { backgroundColor: FairBetTheme.info, color: "#fff" }
                    : {
                        backgroundColor: "var(--fb-surface-secondary)",
                        color: "var(--ds-text-secondary)",
                        border: "1px solid var(--fb-border-subtle)",
                      }
                }
              >
                {mf.label}
              </button>
            ))}

            {/* Separator */}
            <div
              className="self-stretch w-px shrink-0 mx-1"
              style={{ backgroundColor: "var(--fb-border-subtle)" }}
            />

            {/* Toggle pills */}
            <TogglePill label="+EV Only" active={hook.evOnly} onClick={() => hook.setEvOnly(!hook.evOnly)} />
            <TogglePill label="Hide Thin" active={hook.hideThin} onClick={() => hook.setHideThin(!hook.hideThin)} />
          </div>

          {/* Search + meta row */}
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

            {/* Live indicator + timestamp */}
            {hook.lastUpdatedAt && (
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                {new Date(hook.lastUpdatedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* States */}
      {hook.loading && (
        <div className="py-12 space-y-4">
          <div className="text-center text-sm text-neutral-500">Loading live odds...</div>
          <div className="mx-auto w-48 h-1.5 rounded-full overflow-hidden skeleton-shimmer" style={{ backgroundColor: "var(--fb-surface-secondary)" }} />
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="rounded-[14px] h-28 skeleton-shimmer"
                style={{ backgroundColor: "var(--fb-surface-secondary)" }}
              />
            ))}
          </div>
        </div>
      )}

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

      {!hook.loading && !hook.error && hook.gameId === null && (
        <div className="py-12 text-center text-sm text-neutral-500">
          Select a live game to view in-game odds.
        </div>
      )}

      {/* Empty state (game selected but no bets after filtering) */}
      {!hook.loading && !hook.error && hook.gameId !== null && hook.data && hook.bets.length === 0 && (
        <div className="py-12 text-center text-sm text-neutral-500">
          {hook.evOnly
            ? "No +EV bets found. Try disabling the +EV filter."
            : "No live odds available for this game yet."}
        </div>
      )}

      {/* Bet cards */}
      {!hook.loading &&
        hook.bets.slice(0, visibleCount).map((bet) => {
          const id = betId(bet);
          return (
            <BetCard
              key={id}
              bet={bet}
              onShowExplainer={openExplainer}
            />
          );
        })}

      {/* Sentinel + count */}
      {!hook.loading && visibleCount < hook.bets.length && (
        <>
          <div ref={sentinelRef} className="h-px" />
          <div className="text-center text-xs text-neutral-500 py-2">
            Showing {Math.min(visibleCount, hook.bets.length)} of {hook.bets.length}
          </div>
        </>
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

// ── Sub-components ──────────────────────────────────────────

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
      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition"
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

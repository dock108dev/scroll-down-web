"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { APIBet, FairbetLiveResponse, LiveGameInfo } from "@/lib/types";
import { enrichBet, betId, type ParlayLeg } from "@/lib/fairbet-utils";
import { FAIRBET, POLLING } from "@/lib/config";

export interface LiveGameData {
  game: LiveGameInfo;
  response: FairbetLiveResponse;
  bets: APIBet[];
}

export interface UseFairBetLiveReturn {
  /** All discovered live games */
  liveGames: LiveGameInfo[];
  /** Per-game odds data (filtered + enriched) */
  gameData: LiveGameData[];
  /** Flat list of all filtered bets across all games */
  allBets: APIBet[];
  loading: boolean;
  gamesLoading: boolean;
  error: string | null;
  // Filters
  league: string;
  marketCategory: string;
  sortBy: string;
  evOnly: boolean;
  hideThin: boolean;
  hideAlternates: boolean;
  searchText: string;
  availableLeagues: string[];
  availableMarkets: string[];
  setLeague: (v: string) => void;
  setMarketCategory: (mc: string) => void;
  setSortBy: (v: string) => void;
  setEvOnly: (v: boolean) => void;
  setHideThin: (v: boolean) => void;
  setHideAlternates: (v: boolean) => void;
  setSearchText: (text: string) => void;
  refetch: () => void;
  // Parlay
  toggleParlay: (id: string) => void;
  clearParlay: () => void;
  parlayBetIds: Set<string>;
  parlayBets: APIBet[];
  parlayCount: number;
  canShowParlay: boolean;
  staleBetIds: Set<string>;
}

export function useFairBetLive(): UseFairBetLiveReturn {
  const [league, setLeague] = useState("");
  const [marketCategory, setMarketCategory] = useState("");
  const [sortBy, setSortBy] = useState("ev");
  const [evOnly, setEvOnly] = useState(false);
  const [hideThin, setHideThin] = useState(true);
  const [hideAlternates, setHideAlternates] = useState(true);
  const [searchText, setSearchText] = useState("");

  const [liveGames, setLiveGames] = useState<LiveGameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [rawGameResponses, setRawGameResponses] = useState<
    Map<number, FairbetLiveResponse>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parlayLegs, setParlayLegs] = useState<Map<string, ParlayLeg>>(new Map());

  // Track current fetch to avoid stale updates
  const fetchIdRef = useRef(0);

  // ── Discover live games ─────────────────────────────────
  const discoverGames = useCallback(async () => {
    try {
      const games = await api.fairbetLiveGames(league || undefined);
      setLiveGames(games);
      return games;
    } catch {
      setLiveGames([]);
      return [];
    } finally {
      setGamesLoading(false);
    }
  }, [league]);

  // ── Fetch odds for all live games in parallel ───────────
  const fetchAllOdds = useCallback(
    async (games: LiveGameInfo[]) => {
      if (games.length === 0) {
        setRawGameResponses(new Map());
        setLoading(false);
        return;
      }

      const myFetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled(
          games.map((g) =>
            api.fairbetLive(
              g.game_id,
              marketCategory || undefined,
              sortBy || undefined,
            ),
          ),
        );

        // Guard against stale responses
        if (fetchIdRef.current !== myFetchId) return;

        const map = new Map<number, FairbetLiveResponse>();
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const resp = r.value;
            resp.bets = resp.bets.map(enrichBet);
            map.set(games[i].game_id, resp);
          }
        });

        setRawGameResponses(map);

        // If ALL requests failed, show error
        if (map.size === 0 && results.length > 0) {
          setError("Failed to fetch live odds for any game.");
        }
      } catch (err) {
        if (fetchIdRef.current !== myFetchId) return;
        setError(
          err instanceof Error ? err.message : "Failed to fetch live odds",
        );
      } finally {
        if (fetchIdRef.current === myFetchId) {
          setLoading(false);
        }
      }
    },
    [marketCategory, sortBy],
  );

  // ── Full refresh (discover + fetch) ─────────────────────
  const fullRefresh = useCallback(async () => {
    const games = await discoverGames();
    await fetchAllOdds(games);
  }, [discoverGames, fetchAllOdds]);

  // Initial load + re-fetch when league/market changes
  useEffect(() => {
    fullRefresh();
  }, [fullRefresh]);

  // Auto-refresh every 15s
  useEffect(() => {
    const iv = setInterval(fullRefresh, POLLING.LIVE_ODDS_REFRESH_MS);
    return () => clearInterval(iv);
  }, [fullRefresh]);

  // ── Client-side filtering ───────────────────────────────
  const filterBets = useCallback(
    (bets: APIBet[]): APIBet[] => {
      let filtered = bets;

      if (evOnly) {
        filtered = filtered.filter((b) => {
          const best = b.books.find((bk) => bk.book === b.bestBook);
          const ev =
            best?.display_ev ?? best?.ev_percent ?? b.best_ev_percent ?? 0;
          return ev > 0;
        });
      }

      if (hideThin) {
        filtered = filtered.filter(
          (b) => b.books.length >= FAIRBET.MIN_BOOKS,
        );
      }

      if (hideAlternates) {
        filtered = filtered.filter(
          (b) => b.market_category !== "alternate",
        );
      }

      if (searchText) {
        const q = searchText.toLowerCase();
        filtered = filtered.filter(
          (b) =>
            (
              b.selectionDisplay ??
              b.selection_display ??
              b.selection_key ??
              ""
            )
              .toLowerCase()
              .includes(q) ||
            b.home_team.toLowerCase().includes(q) ||
            b.away_team.toLowerCase().includes(q) ||
            (b.player_name ?? "").toLowerCase().includes(q),
        );
      }

      return filtered;
    },
    [evOnly, hideThin, hideAlternates, searchText],
  );

  // ── Build per-game data with filtered bets ──────────────
  const gameData = useMemo((): LiveGameData[] => {
    const result: LiveGameData[] = [];
    for (const game of liveGames) {
      const response = rawGameResponses.get(game.game_id);
      if (!response) continue;
      const bets = filterBets(response.bets);
      result.push({ game, response, bets });
    }
    return result;
  }, [liveGames, rawGameResponses, filterBets]);

  // Flat list of all filtered bets
  const allBets = useMemo(
    () => gameData.flatMap((gd) => gd.bets),
    [gameData],
  );

  // ── Available filter options ────────────────────────────
  const availableLeagues = useMemo(() => {
    const set = new Set(liveGames.map((g) => g.league_code));
    return Array.from(set).sort();
  }, [liveGames]);

  const availableMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const resp of rawGameResponses.values()) {
      for (const cat of resp.market_categories_available ?? []) {
        set.add(cat);
      }
    }
    return Array.from(set).sort();
  }, [rawGameResponses]);

  // ── Parlay ──────────────────────────────────────────────
  const allBetsById = useMemo(() => {
    const map = new Map<string, APIBet>();
    for (const resp of rawGameResponses.values()) {
      for (const b of resp.bets) map.set(betId(b), b);
    }
    return map;
  }, [rawGameResponses]);

  // Derive convenience values from snapshot map
  const parlayBetIds = useMemo(() => new Set(parlayLegs.keys()), [parlayLegs]);
  const parlayBets = useMemo(
    () => Array.from(parlayLegs.values()).map((l) => l.snapshot),
    [parlayLegs],
  );
  const staleBetIds = useMemo(
    () => new Set(
      Array.from(parlayLegs.entries())
        .filter(([, l]) => l.status === "stale")
        .map(([id]) => id),
    ),
    [parlayLegs],
  );

  // Reconcile parlay legs when bets refresh
  useEffect(() => {
    if (parlayLegs.size === 0) return;
    setParlayLegs((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, leg] of next) {
        const fresh = allBetsById.get(id);
        if (!fresh) {
          if (leg.status !== "stale") {
            next.set(id, { ...leg, status: "stale" });
            changed = true;
          }
        } else {
          const probDiff = Math.abs((fresh.true_prob ?? 0) - (leg.snapshot.true_prob ?? 0));
          const priceDiff = Math.abs((fresh.reference_price ?? 0) - (leg.snapshot.reference_price ?? 0));
          const isStale = probDiff > 0.001 || priceDiff > 0.5;

          if (isStale && leg.status !== "stale") {
            next.set(id, { ...leg, status: "stale" });
            changed = true;
          } else if (!isStale && leg.status !== "fresh") {
            next.set(id, { ...leg, snapshot: fresh, status: "fresh" });
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBetsById]);

  const toggleParlay = useCallback((id: string) => {
    setParlayLegs((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const bet = allBetsById.get(id);
        if (bet) {
          next.set(id, { id, snapshot: bet, status: "fresh" });
        }
      }
      return next;
    });
  }, [allBetsById]);

  const clearParlay = useCallback(() => setParlayLegs(new Map()), []);

  return {
    liveGames,
    gameData,
    allBets,
    loading,
    gamesLoading,
    error,
    league,
    marketCategory,
    sortBy,
    evOnly,
    hideThin,
    hideAlternates,
    searchText,
    availableLeagues,
    availableMarkets,
    setLeague,
    setMarketCategory,
    setSortBy,
    setEvOnly,
    setHideThin,
    setHideAlternates,
    setSearchText,
    refetch: fullRefresh,
    toggleParlay,
    clearParlay,
    parlayBetIds,
    parlayBets,
    parlayCount: parlayLegs.size,
    canShowParlay: parlayLegs.size >= 2,
    staleBetIds,
  };
}

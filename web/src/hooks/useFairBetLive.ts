"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { APIBet, FairbetLiveResponse, LiveGameInfo } from "@/lib/types";
import { enrichBet, betId } from "@/lib/fairbet-utils";
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
  const [parlayIds, setParlayIds] = useState<Set<string>>(new Set());

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

  const toggleParlay = useCallback((id: string) => {
    setParlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearParlay = useCallback(() => setParlayIds(new Set()), []);

  const parlayBets = useMemo(
    () =>
      Array.from(parlayIds)
        .map((id) => allBetsById.get(id))
        .filter(Boolean) as APIBet[],
    [parlayIds, allBetsById],
  );

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
    parlayBetIds: parlayIds,
    parlayBets,
    parlayCount: parlayIds.size,
    canShowParlay: parlayIds.size >= 2,
  };
}

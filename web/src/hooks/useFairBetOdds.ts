"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { APIBet } from "@/lib/types";
import {
  betId,
  enrichBet,
  isReliablyPositive,
  marketKeyToCategory,
} from "@/lib/fairbet-utils";

// ── Types ──────────────────────────────────────────────────────────

export type SortMode = "bestEV" | "gameTime" | "league";

export interface FairBetFilters {
  league: string;
  market: string; // moneyline | spread | total | player_props | team_props | ""
  book: string;
  searchText: string;
  evOnly: boolean;
  hideThin: boolean;
  hideStarted: boolean;
  sort: SortMode;
}

export interface UseFairBetOddsReturn {
  /** All bets from all pages (raw from API). */
  allBets: APIBet[];
  /** Filtered + sorted bets ready to render. */
  filteredBets: APIBet[];
  /** Initial loading (first page). */
  loading: boolean;
  /** Loading subsequent pages. */
  isLoadingMore: boolean;
  /** Progress text e.g. "Loading 500 of 1,200..." */
  loadingProgress: string;
  /** Progress fraction 0-1. */
  loadingFraction: number;
  /** Error message (null if none). */
  error: string | null;
  /** Refetch all data. */
  refetch: () => void;

  // ── Filter state ──
  filters: FairBetFilters;
  setLeague: (v: string) => void;
  setMarket: (v: string) => void;
  setBook: (v: string) => void;
  setSearchText: (v: string) => void;
  setEvOnly: (v: boolean) => void;
  setHideThin: (v: boolean) => void;
  setHideStarted: (v: boolean) => void;
  setSort: (v: SortMode) => void;

  // ── Available options (from raw data) ──
  availableLeagues: string[];
  availableBooks: string[];
  availableMarkets: string[]; // high-level categories present in data

  // ── Computed stats ──
  totalBetsCount: number;
  positiveEVCount: number;
  bestEVAvailable: number;
  filteredTotalCount: number;
  filteredPositiveEVCount: number;

  // ── Parlay ──
  parlayBetIds: Set<string>;
  parlayBets: APIBet[];
  parlayCount: number;
  canShowParlay: boolean;
  parlayFairProbability: number;
  parlayFairAmericanOdds: number;
  parlayConfidence: string;
  toggleParlay: (id: string) => void;
  clearParlay: () => void;
}

// ── Constants ──────────────────────────────────────────────────────

const PAGE_SIZE = 100;
const MAX_CONCURRENT = 3;

// ── Hook ───────────────────────────────────────────────────────────

export function useFairBetOdds(): UseFairBetOddsReturn {
  // Raw data
  const [allBets, setAllBets] = useState<APIBet[]>([]);
  const [booksAvailable, setBooksAvailable] = useState<string[]>([]);
  const [totalFromServer, setTotalFromServer] = useState(0);

  // Loading
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<FairBetFilters>({
    league: "",
    market: "",
    book: "",
    searchText: "",
    evOnly: false,
    hideThin: false,
    hideStarted: false,
    sort: "bestEV",
  });

  // Parlay
  const [parlayBetIds, setParlayBetIds] = useState<Set<string>>(new Set());

  // Abort controller for cancellation
  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch logic ──────────────────────────────────────────────────

  const fetchOdds = useCallback(async () => {
    // Cancel any in-flight fetches
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setLoadedCount(0);
    setAllBets([]);

    try {
      // First page
      const params = new URLSearchParams();
      params.set("has_fair", "true");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", "0");

      const firstPage = await api.fairbetOdds(params);
      if (controller.signal.aborted) return;

      const total = firstPage.total ?? firstPage.bets.length;
      setTotalFromServer(total);
      setBooksAvailable(firstPage.books_available ?? []);
      setAllBets(firstPage.bets.map(enrichBet));
      setLoadedCount(firstPage.bets.length);

      // Done with initial load
      setLoading(false);

      // Remaining pages
      if (firstPage.bets.length < total) {
        setIsLoadingMore(true);
        const remainingOffsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
          remainingOffsets.push(offset);
        }

        // Fetch remaining pages with concurrency limit
        const allRemaining: APIBet[] = [];
        let loaded = firstPage.bets.length;

        for (let i = 0; i < remainingOffsets.length; i += MAX_CONCURRENT) {
          if (controller.signal.aborted) return;
          const batch = remainingOffsets.slice(i, i + MAX_CONCURRENT);
          const results = await Promise.all(
            batch.map((offset) => {
              const p = new URLSearchParams();
              p.set("has_fair", "true");
              p.set("limit", String(PAGE_SIZE));
              p.set("offset", String(offset));
              return api.fairbetOdds(p);
            }),
          );
          if (controller.signal.aborted) return;
          for (const result of results) {
            allRemaining.push(...result.bets);
            loaded += result.bets.length;
          }
          setLoadedCount(loaded);
          // Append incrementally
          setAllBets((prev) => [...prev, ...results.flatMap((r) => r.bets).map(enrichBet)]);
        }

        setIsLoadingMore(false);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to fetch odds");
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching-on-mount pattern requires setState for loading/error/data
    fetchOdds();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchOdds]);

  // ── Loading progress ─────────────────────────────────────────────

  const loadingFraction = totalFromServer > 0
    ? Math.min(loadedCount / totalFromServer, 1)
    : 0;

  const loadingProgress =
    loading
      ? "Loading bets..."
      : isLoadingMore
        ? `Loading ${loadedCount.toLocaleString()} of ${totalFromServer.toLocaleString()}...`
        : "";

  // ── Available options from raw data ──────────────────────────────

  const availableLeagues = useMemo(() => {
    const set = new Set<string>();
    for (const bet of allBets) {
      if (bet.league_code) set.add(bet.league_code.toLowerCase());
    }
    return Array.from(set).sort();
  }, [allBets]);

  const availableBooks = useMemo(() => {
    return booksAvailable.length > 0
      ? booksAvailable
      : Array.from(new Set(allBets.flatMap((b) => b.books.map((bp) => bp.book)))).sort();
  }, [allBets, booksAvailable]);

  const availableMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const bet of allBets) {
      set.add(marketKeyToCategory(bet.market_key));
    }
    return Array.from(set).sort();
  }, [allBets]);

  // ── Client-side filtering + sorting ──────────────────────────────

  const filteredBets = useMemo(() => {
    const now = new Date();
    let result = allBets;

    // Filter: only bets with 3+ books
    result = result.filter((b) => b.books.length >= 3);

    // Filter: league
    if (filters.league) {
      result = result.filter(
        (b) => b.league_code.toLowerCase() === filters.league.toLowerCase(),
      );
    }

    // Filter: market category
    if (filters.market) {
      result = result.filter(
        (b) => marketKeyToCategory(b.market_key) === filters.market,
      );
    }

    // Filter: book (bet must have at least one price from this book)
    if (filters.book) {
      result = result.filter(
        (b) => b.books.some((bp) => bp.book.toLowerCase() === filters.book.toLowerCase()),
      );
    }

    // Filter: search text
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      result = result.filter((b) => {
        return (
          b.home_team.toLowerCase().includes(q) ||
          b.away_team.toLowerCase().includes(q) ||
          b.selection_key.toLowerCase().includes(q) ||
          (b.player_name && b.player_name.toLowerCase().includes(q))
        );
      });
    }

    // Filter: +EV only (reliable positive EV)
    if (filters.evOnly) {
      result = result.filter((b) => {
        return isReliablyPositive(bestEVForBet(b), b.ev_confidence_tier);
      });
    }

    // Filter: hide thin markets
    if (filters.hideThin) {
      result = result.filter(
        (b) =>
          b.ev_confidence_tier !== "thin" && b.ev_confidence_tier !== "none",
      );
    }

    // Filter: hide started games
    if (filters.hideStarted) {
      result = result.filter((b) => {
        const gameDate = new Date(b.game_date);
        return gameDate > now;
      });
    }

    // Sort
    switch (filters.sort) {
      case "bestEV":
        result = [...result].sort((a, b) => {
          const evA = bestEVForBet(a);
          const evB = bestEVForBet(b);
          return evB - evA;
        });
        break;
      case "gameTime":
        result = [...result].sort((a, b) => {
          return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        });
        break;
      case "league":
        result = [...result].sort((a, b) => {
          const cmp = a.league_code.localeCompare(b.league_code);
          if (cmp !== 0) return cmp;
          // Secondary sort by EV within league
          const evA = bestEVForBet(a);
          const evB = bestEVForBet(b);
          return evB - evA;
        });
        break;
    }

    return result;
  }, [allBets, filters]);

  // ── Computed stats ───────────────────────────────────────────────

  const betsWithEnoughBooks = useMemo(
    () => allBets.filter((b) => b.books.length >= 3),
    [allBets],
  );

  const totalBetsCount = betsWithEnoughBooks.length;

  const positiveEVCount = useMemo(
    () =>
      betsWithEnoughBooks.filter((b) => {
        return isReliablyPositive(bestEVForBet(b), b.ev_confidence_tier);
      }).length,
    [betsWithEnoughBooks],
  );

  const bestEVAvailable = useMemo(() => {
    let best = 0;
    for (const b of betsWithEnoughBooks) {
      const ev = bestEVForBet(b);
      if (ev > best) {
        best = ev;
      }
    }
    return best;
  }, [betsWithEnoughBooks]);

  const filteredTotalCount = filteredBets.length;

  const filteredPositiveEVCount = useMemo(
    () =>
      filteredBets.filter((b) => {
        return isReliablyPositive(bestEVForBet(b), b.ev_confidence_tier);
      }).length,
    [filteredBets],
  );

  // ── Parlay ───────────────────────────────────────────────────────

  const parlayBets = useMemo(() => {
    if (parlayBetIds.size === 0) return [];
    return allBets.filter((b) => parlayBetIds.has(betId(b)));
  }, [allBets, parlayBetIds]);

  const parlayCount = parlayBetIds.size;
  const canShowParlay = parlayCount >= 2;

  // ── Parlay evaluation (API with client-side fallback) ──────────

  const [parlayApiResult, setParlayApiResult] = useState<{
    fair_probability: number;
    fair_american_odds: number;
    confidence: string;
  } | null>(null);

  // Call API when parlay legs change
  useEffect(() => {
    if (parlayBets.length < 2) return;

    const legs = parlayBets.map((b) => ({
      game_id: b.game_id,
      market_key: b.market_key,
      selection_key: b.selection_key,
      line_value: b.line_value,
    }));

    let cancelled = false;
    api.parlayEvaluate(legs)
      .then((result) => {
        if (!cancelled) setParlayApiResult(result);
      })
      .catch(() => {
        if (!cancelled) setParlayApiResult(null);
      });

    return () => { cancelled = true; };
  }, [parlayBets]);

  const parlayFairProbability = parlayBets.length >= 2 ? (parlayApiResult?.fair_probability ?? 0) : 0;
  const parlayFairAmericanOdds = parlayBets.length >= 2 ? (parlayApiResult?.fair_american_odds ?? 0) : 0;
  const parlayConfidence = parlayBets.length >= 2 ? (parlayApiResult?.confidence ?? "none") : "none";

  const toggleParlay = useCallback((id: string) => {
    setParlayBetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearParlay = useCallback(() => {
    setParlayBetIds(new Set());
  }, []);

  // ── Filter setters ───────────────────────────────────────────────

  const setLeague = useCallback((v: string) => setFilters((p) => ({ ...p, league: v })), []);
  const setMarket = useCallback((v: string) => setFilters((p) => ({ ...p, market: v })), []);
  const setBook = useCallback((v: string) => setFilters((p) => ({ ...p, book: v })), []);
  const setSearchText = useCallback((v: string) => setFilters((p) => ({ ...p, searchText: v })), []);
  const setEvOnly = useCallback((v: boolean) => setFilters((p) => ({ ...p, evOnly: v })), []);
  const setHideThin = useCallback((v: boolean) => setFilters((p) => ({ ...p, hideThin: v })), []);
  const setHideStarted = useCallback((v: boolean) => setFilters((p) => ({ ...p, hideStarted: v })), []);
  const setSort = useCallback((v: SortMode) => setFilters((p) => ({ ...p, sort: v })), []);

  return {
    allBets,
    filteredBets,
    loading,
    isLoadingMore,
    loadingProgress,
    loadingFraction,
    error,
    refetch: fetchOdds,

    filters,
    setLeague,
    setMarket,
    setBook,
    setSearchText,
    setEvOnly,
    setHideThin,
    setHideStarted,
    setSort,

    availableLeagues,
    availableBooks,
    availableMarkets,

    totalBetsCount,
    positiveEVCount,
    bestEVAvailable,
    filteredTotalCount,
    filteredPositiveEVCount,

    parlayBetIds,
    parlayBets,
    parlayCount,
    canShowParlay,
    parlayFairProbability,
    parlayFairAmericanOdds,
    parlayConfidence,
    toggleParlay,
    clearParlay,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/** Get the best EV percent for a bet from the API field. */
function bestEVForBet(bet: APIBet): number {
  return bet.bestEvPercent ?? 0;
}

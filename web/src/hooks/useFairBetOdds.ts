"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { APIBet } from "@/lib/types";
import { CACHE, API, FAIRBET } from "@/lib/config";
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";
import { fairbetChannel } from "@/realtime/channels";
import { useGameData } from "@/stores/game-data";
import { useVisibilityRefresh } from "./useVisibilityRefresh";
import {
  betId,
  enrichBet,
  isReliablyPositive,
  marketKeyToCategory,
  legFairProb,
  parlayProbIndependent,
  probToDecimal,
  decimalToAmerican,
  hasCorrelatedLegs,
  parlayConfidenceTier,
  type ParlayLeg,
} from "@/lib/fairbet-utils";
import {
  type SortMode,
  type FairBetFilters,
  DEFAULT_FILTERS,
  bestEVForBet,
  filterAndSortBets,
} from "@/lib/fairbet-filters";

export type { SortMode, FairBetFilters };

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
  parlayCorrelated: boolean;
  staleBetIds: Set<string>;
  toggleParlay: (id: string) => void;
  clearParlay: () => void;
}

// ── In-memory cache ────────────────────────────────────────────────

interface FairBetCacheEntry {
  allBets: APIBet[];
  booksAvailable: string[];
  totalFromServer: number;
  fetchedAt: number;
}

let fairbetCache: FairBetCacheEntry | null = null;

function getFairbetCached(): FairBetCacheEntry | null {
  if (!fairbetCache) return null;
  if (Date.now() - fairbetCache.fetchedAt > CACHE.FAIRBET_TTL_MS) {
    fairbetCache = null;
    return null;
  }
  return fairbetCache;
}

function setFairbetCache(allBets: APIBet[], booksAvailable: string[], totalFromServer: number) {
  fairbetCache = { allBets, booksAvailable, totalFromServer, fetchedAt: Date.now() };
}

// ── Hook ───────────────────────────────────────────────────────────

export function useFairBetOdds(): UseFairBetOddsReturn {
  const cached = getFairbetCached();

  // Raw data
  const [allBets, setAllBets] = useState<APIBet[]>(cached?.allBets ?? []);
  const [booksAvailable, setBooksAvailable] = useState<string[]>(cached?.booksAvailable ?? []);
  const [totalFromServer, setTotalFromServer] = useState(cached?.totalFromServer ?? 0);

  // Loading
  const [loading, setLoading] = useState(!cached);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<FairBetFilters>(DEFAULT_FILTERS);

  // Parlay — snapshot-based to survive odds refreshes
  const [parlayLegs, setParlayLegs] = useState<Map<string, ParlayLeg>>(new Map());

  // Abort controller for cancellation
  const abortRef = useRef<AbortController | null>(null);

  // ── Core fetch logic ─────────────────────────────────────────────

  const doFullFetch = useCallback(async (controller: AbortController) => {
    // First page
    const params = new URLSearchParams();
    params.set("has_fair", "true");
    params.set("limit", String(API.FAIRBET_PAGE_SIZE));
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
    let finalBets = firstPage.bets.map(enrichBet);

    if (firstPage.bets.length < total) {
      setIsLoadingMore(true);
      const remainingOffsets: number[] = [];
      for (let offset = API.FAIRBET_PAGE_SIZE; offset < total; offset += API.FAIRBET_PAGE_SIZE) {
        remainingOffsets.push(offset);
      }

      // Fetch remaining pages with concurrency limit
      let loaded = firstPage.bets.length;

      for (let i = 0; i < remainingOffsets.length; i += API.FAIRBET_MAX_CONCURRENT) {
        if (controller.signal.aborted) return;
        const batch = remainingOffsets.slice(i, i + API.FAIRBET_MAX_CONCURRENT);
        const results = await Promise.all(
          batch.map((offset) => {
            const p = new URLSearchParams();
            p.set("has_fair", "true");
            p.set("limit", String(API.FAIRBET_PAGE_SIZE));
            p.set("offset", String(offset));
            return api.fairbetOdds(p);
          }),
        );
        if (controller.signal.aborted) return;
        const batchBets = results.flatMap((r) => r.bets).map(enrichBet);
        finalBets = [...finalBets, ...batchBets];
        for (const result of results) {
          loaded += result.bets.length;
        }
        setLoadedCount(loaded);
        // Append incrementally
        setAllBets((prev) => [...prev, ...batchBets]);
      }

      setIsLoadingMore(false);
    }

    // Write completed data to cache
    setFairbetCache(finalBets, firstPage.books_available ?? [], total);
  }, []);

  // ── Public fetch (with cache check) ─────────────────────────────

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
      await doFullFetch(controller);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to fetch odds");
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [doFullFetch]);

  // Initial fetch (with cache check)
  useEffect(() => {
    const entry = getFairbetCached();
    if (entry) {
      const age = Date.now() - entry.fetchedAt;
      if (age < CACHE.FAIRBET_FRESH_MS) {
        // Fresh cache — skip network entirely
        return;
      }
      // Stale cache — show cached data, do silent background refresh
      const controller = new AbortController();
      abortRef.current = controller;
      doFullFetch(controller).catch(() => {
        // Silent refresh failed — cached data still shown
      });
      return () => {
        controller.abort();
      };
    }

    // No cache — normal full fetch
    fetchOdds();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime subscription (channels only — dispatcher handles events) ──

  const realtimeStatus = useGameData((s) => s.realtimeStatus);
  const needsFairbetRefresh = useGameData((s) => s.needsFairbetRefresh);
  const clearFairbetRefresh = useGameData((s) => s.clearFairbetRefresh);

  const channels = useMemo(() => [fairbetChannel()], []);
  useRealtimeSubscription(channels);

  // Watch recovery flag set by dispatcher
  const lastSeenRefresh = useRef(0);
  useEffect(() => {
    if (needsFairbetRefresh === 0 || needsFairbetRefresh === lastSeenRefresh.current) return;
    lastSeenRefresh.current = needsFairbetRefresh;
    const counter = needsFairbetRefresh;

    fairbetCache = null;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    doFullFetch(controller)
      .then(() => clearFairbetRefresh(counter))
      .catch(() => clearFairbetRefresh(counter));
  }, [needsFairbetRefresh, clearFairbetRefresh, doFullFetch]);

  // Visibility change: refresh when returning from background
  useVisibilityRefresh(
    () => {
      fairbetCache = null;
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      doFullFetch(controller).catch(() => {
        // Silent — stale data still shown
      });
    },
    realtimeStatus.connected,
  );

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

  const filteredBets = useMemo(
    () => filterAndSortBets(allBets, filters),
    [allBets, filters],
  );

  // ── Computed stats ───────────────────────────────────────────────

  const betsWithEnoughBooks = useMemo(
    () => allBets.filter((b) => b.books.length >= FAIRBET.MIN_BOOKS),
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

  // Derive convenience values from the snapshot map
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

  const parlayCount = parlayLegs.size;
  const canShowParlay = parlayCount >= 2;

  // Reconcile parlay legs when allBets changes (refresh / realtime)
  useEffect(() => {
    if (parlayLegs.size === 0) return;
    const betsById = new Map<string, APIBet>();
    for (const b of allBets) betsById.set(betId(b), b);

    setParlayLegs((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, leg] of next) {
        const fresh = betsById.get(id);
        if (!fresh) {
          // Bet disappeared — mark stale
          if (leg.status !== "stale") {
            next.set(id, { ...leg, status: "stale" });
            changed = true;
          }
        } else {
          // Check if odds changed materially
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
  }, [allBets]);

  // ── Client-side parlay evaluation ──────────────────────────────

  const parlayCorrelated = useMemo(
    () => parlayBets.length >= 2 && hasCorrelatedLegs(parlayBets),
    [parlayBets],
  );

  const parlayResult = useMemo(() => {
    if (parlayBets.length < 2) {
      return { probability: 0, americanOdds: 0, confidence: "none" };
    }

    const legProbs: number[] = [];
    let allValid = true;
    for (const bet of parlayBets) {
      const p = legFairProb(bet);
      if (p == null) {
        allValid = false;
        break;
      }
      legProbs.push(p);
    }

    if (!allValid) {
      return { probability: 0, americanOdds: 0, confidence: "none" };
    }

    const pFair = parlayProbIndependent(legProbs);
    if (!Number.isFinite(pFair) || pFair <= 0) {
      return { probability: 0, americanOdds: 0, confidence: "none" };
    }

    const fairDecimal = probToDecimal(pFair);
    const fairAmerican = decimalToAmerican(fairDecimal);
    const confidence = parlayConfidenceTier(parlayBets, true, parlayCorrelated);

    return {
      probability: pFair,
      americanOdds: Number.isFinite(fairAmerican) ? fairAmerican : 0,
      confidence,
    };
  }, [parlayBets, parlayCorrelated]);

  const parlayFairProbability = parlayResult.probability;
  const parlayFairAmericanOdds = parlayResult.americanOdds;
  const parlayConfidence = parlayResult.confidence;

  const toggleParlay = useCallback((id: string) => {
    setParlayLegs((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Snapshot the bet at toggle time
        const bet = allBets.find((b) => betId(b) === id);
        if (bet) {
          next.set(id, { id, snapshot: bet, status: "fresh" });
        }
      }
      return next;
    });
  }, [allBets]);

  const clearParlay = useCallback(() => {
    setParlayLegs(new Map());
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
    parlayCorrelated,
    staleBetIds,
    toggleParlay,
    clearParlay,
  };
}

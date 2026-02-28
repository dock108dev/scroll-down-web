"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GameFlowResponse } from "@/lib/types";
import { CACHE } from "@/lib/config";

// ─── In-memory cache ───────────────────────────────────────────

interface FlowCacheEntry {
  data: GameFlowResponse;
  fetchedAt: number;
}

const cache = new Map<number, FlowCacheEntry>();

function getCached(id: number): GameFlowResponse | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE.FLOW_TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.data;
}

function setCache(id: number, data: GameFlowResponse) {
  if (cache.size >= CACHE.FLOW_MAX_ENTRIES && !cache.has(id)) {
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.fetchedAt < oldestTime) {
        oldestTime = entry.fetchedAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) cache.delete(oldestKey);
  }
  cache.set(id, { data, fetchedAt: Date.now() });
}

// ─── Hook ──────────────────────────────────────────────────────

export function useFlow(id: number) {
  const cached = getCached(id);
  const [data, setData] = useState<GameFlowResponse | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchFlow = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await api.flow(id);
        setCache(id, result);
        setData(result);
      } catch (err) {
        if (!opts?.silent) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch game flow",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (cached) {
      // Have cached data — show it immediately, refresh silently in background
      fetchFlow({ silent: true });
    } else {
      fetchFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFlow]);

  return { data, loading, error, refetch: fetchFlow };
}

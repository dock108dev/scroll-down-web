"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GameFlowResponse } from "@/lib/types";
import { useGameData } from "@/stores/game-data";

export function useGameFlow(id: number) {
  const upsertFlow = useGameData((s) => s.upsertFlow);
  const isFlowFresh = useGameData((s) => s.isFlowFresh);
  const getFlow = useGameData((s) => s.getFlow);

  const cached = getFlow(id);
  const [data, setData] = useState<GameFlowResponse | null>(cached ?? null);
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
        upsertFlow(id, result);
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
    [id, upsertFlow],
  );

  useEffect(() => {
    if (cached && isFlowFresh(id)) {
      // Have fresh cached data — show it immediately, refresh silently
      fetchFlow({ silent: true });
    } else {
      fetchFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFlow]);

  return { data, loading, error, refetch: fetchFlow };
}

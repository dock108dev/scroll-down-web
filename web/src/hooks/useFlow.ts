"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GameFlowResponse } from "@/lib/types";

export function useFlow(id: number) {
  const [data, setData] = useState<GameFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.flow(id);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch game flow",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  return { data, loading, error, refetch: fetchFlow };
}

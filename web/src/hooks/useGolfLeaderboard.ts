"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GolfTournament, GolfLeaderboardEntry } from "@/lib/golf-types";
import { POLLING } from "@/lib/config";

export function useGolfLeaderboard(eventId: string) {
  const [tournament, setTournament] = useState<GolfTournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<GolfLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const [tournamentData, leaderboardData] = await Promise.all([
          api.golfTournament(eventId),
          api.golfLeaderboard(eventId),
        ]);
        setTournament(tournamentData);
        setLeaderboard(leaderboardData.leaderboard);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch leaderboard",
        );
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll when tournament is in progress
  useEffect(() => {
    if (tournament?.status !== "in_progress") return;
    const id = setInterval(
      () => fetchData({ silent: true }),
      POLLING.GOLF_LEADERBOARD_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [tournament?.status, fetchData]);

  return { tournament, leaderboard, loading, error, refetch: fetchData };
}

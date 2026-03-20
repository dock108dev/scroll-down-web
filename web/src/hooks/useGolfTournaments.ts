"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GolfTournament } from "@/lib/golf-types";
import { POLLING } from "@/lib/config";

export interface GolfTournamentSections {
  thisWeek: GolfTournament[];
  upcoming: GolfTournament[];
  recent: GolfTournament[];
}

export function useGolfTournaments() {
  const [tournaments, setTournaments] = useState<GolfTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await api.golfTournaments();
      setTournaments(data.tournaments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch tournaments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  // Poll for updates
  useEffect(() => {
    const id = setInterval(
      () => fetchTournaments({ silent: true }),
      POLLING.GOLF_TOURNAMENTS_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [fetchTournaments]);

  const sections: GolfTournamentSections = useMemo(() => {
    const now = new Date();
    const thisWeek: GolfTournament[] = [];
    const upcoming: GolfTournament[] = [];
    const recent: GolfTournament[] = [];

    for (const t of tournaments) {
      if (t.status === "in_progress") {
        thisWeek.push(t);
      } else if (t.status === "upcoming") {
        // Show tournaments starting within 7 days as "this week", rest as upcoming
        const start = new Date(t.start_date);
        const daysUntil =
          (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil <= 7) {
          thisWeek.push(t);
        } else {
          upcoming.push(t);
        }
      } else if (t.status === "completed") {
        recent.push(t);
      }
    }

    return { thisWeek, upcoming, recent };
  }, [tournaments]);

  return { sections, tournaments, loading, error, refetch: fetchTournaments };
}

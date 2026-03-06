"use client";

import { useCallback } from "react";
import { useUI } from "@/stores/ui";
import { useGameData } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { pickSnapshot } from "@/lib/score-display";
import { isLive, isFinal } from "@/lib/types";

/**
 * Provides the followingLive flag and a toggle function.
 * When toggling OFF, snapshots all games with scores so they
 * freeze in place when returning to onMarkRead mode.
 */
export function useFollowingLive() {
  const followingLive = useUI((s) => s.followingLive);
  const setFollowingLive = useUI((s) => s.setFollowingLive);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  const toggle = useCallback(() => {
    if (followingLive) {
      // Turning OFF → snapshot all games with scores
      const games = useGameData.getState().games;
      const entries: { gameId: number; snapshot: ReturnType<typeof pickSnapshot> }[] = [];

      for (const [gameId, entry] of games) {
        const { core } = entry;
        const hasScores = core.homeScore != null && core.awayScore != null;
        const relevant = isLive(core.status, core) || isFinal(core.status, core);
        if (hasScores && relevant) {
          entries.push({ gameId, snapshot: pickSnapshot(core) });
        }
      }

      if (entries.length > 0) {
        useReveal.getState().revealBatch(entries);
      }

      setFollowingLive(false);
    } else {
      // Turning ON → just flip the flag
      setFollowingLive(true);
    }
  }, [followingLive, setFollowingLive]);

  // Only meaningful when base mode is onMarkRead
  const available = scoreRevealMode === "onMarkRead";

  return { followingLive, toggle, available };
}

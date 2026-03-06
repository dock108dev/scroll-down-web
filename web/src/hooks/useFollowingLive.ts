"use client";

import { useCallback, useEffect, useRef } from "react";
import { useUI } from "@/stores/ui";
import { useGameData } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { pickSnapshot } from "@/lib/score-display";
import { isLive, isFinal } from "@/lib/types";

const LIVE_TIMEOUT_MS = 120 * 60_000; // 120 minutes
const CHECK_INTERVAL_MS = 60_000; // check every minute

/** Snapshot all visible games and turn off following-live. */
function disableLive() {
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

  useUI.getState().setFollowingLive(false);
}

/**
 * Provides the followingLive flag and a toggle function.
 * When toggling OFF, snapshots all games with scores so they
 * freeze in place when returning to onMarkRead mode.
 *
 * Auto-expires after 120 minutes of inactivity (no pointer/keyboard/
 * touch events or page visibility changes).
 */
export function useFollowingLive() {
  const followingLive = useUI((s) => s.followingLive);
  const setFollowingLive = useUI((s) => s.setFollowingLive);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const lastActivityRef = useRef(0);

  // Track user activity while following live
  useEffect(() => {
    if (!followingLive) return;

    lastActivityRef.current = Date.now(); // seed on activation

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listen for any meaningful user interaction
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("visibilitychange", onActivity);

    // Periodically check if we've exceeded the timeout
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= LIVE_TIMEOUT_MS) {
        disableLive();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("visibilitychange", onActivity);
      clearInterval(interval);
    };
  }, [followingLive]);

  const toggle = useCallback(() => {
    if (followingLive) {
      disableLive();
    } else {
      setFollowingLive(true);
    }
  }, [followingLive, setFollowingLive]);

  // Only meaningful when base mode is onMarkRead
  const available = scoreRevealMode === "onMarkRead";

  return { followingLive, toggle, available };
}

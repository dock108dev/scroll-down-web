"use client";

import { useEffect, useState } from "react";
import { useGameData } from "@/stores/game-data";
import { FRESHNESS } from "@/lib/config";

export type FreshnessSeverity = "amber" | "red";

export interface FreshnessLabel {
  text: string;
  severity: FreshnessSeverity;
}

function computeLabel(
  coreUpdatedAt: number,
  now: number,
): FreshnessLabel | null {
  if (coreUpdatedAt === 0) return null;
  const ageMs = now - coreUpdatedAt;
  if (ageMs < FRESHNESS.LABEL_MIN_MS) return null;
  if (ageMs < FRESHNESS.RED_THRESHOLD_MS) {
    return { text: "May be delayed", severity: "amber" };
  }
  return { text: "Data delayed", severity: "red" };
}

export function useFreshnessLabel(
  gameId: number,
  isLiveGame: boolean,
): FreshnessLabel | null {
  const coreUpdatedAt = useGameData(
    (s) => s.getGame(gameId)?.coreUpdatedAt ?? 0,
  );
  // Updated by interval tick so delayed-state labels can appear without re-fetching.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLiveGame) return;
    const id = setInterval(
      () => setNow(Date.now()),
      FRESHNESS.UPDATE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [isLiveGame]);

  if (!isLiveGame) return null;
  return computeLabel(coreUpdatedAt, now);
}

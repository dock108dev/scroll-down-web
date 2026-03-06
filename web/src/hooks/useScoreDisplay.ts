"use client";

import { useGameData } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { computeScoreDisplay } from "@/lib/score-display";
import type { ScoreDisplayResult } from "@/lib/score-display";

export function useScoreDisplay(gameId: number): ScoreDisplayResult | null {
  const core = useGameData((s) => s.getCore(gameId));
  const activeGameId = useGameData((s) => s.activeGameId);
  const revealed = useReveal((s) => s.isRevealed(gameId));
  const snapshot = useReveal((s) => s.getSnapshot(gameId));
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const followingLive = useUI((s) => s.followingLive);

  if (!core) return null;

  // When following live, treat as "always show" regardless of base setting
  const effectiveMode = followingLive ? "always" : scoreRevealMode;

  const isActiveView = activeGameId === gameId;
  return computeScoreDisplay(core, revealed, snapshot, effectiveMode, isActiveView);
}

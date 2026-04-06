"use client";

import { useGameData } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { computeScoreDisplay } from "@/lib/score-display";
import type { ScoreDisplayResult } from "@/lib/score-display";
import { isGameHiddenByBlacklist } from "@/lib/score-hide";

export function useScoreDisplay(gameId: number): ScoreDisplayResult | null {
  const core = useGameData((s) => s.getCore(gameId));
  const revealed = useReveal((s) => s.isRevealed(gameId));
  const snapshot = useReveal((s) => s.getSnapshot(gameId));
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const scoreHideLeagues = useSettings((s) => s.scoreHideLeagues);
  const scoreHideTeams = useSettings((s) => s.scoreHideTeams);
  const followingLive = useSettings((s) => s.followingLive);

  if (!core) return null;

  // When following live, treat as "always show" regardless of base setting
  const effectiveMode = (() => {
    if (followingLive) return "always";
    if (scoreRevealMode !== "blacklist") return scoreRevealMode;
    return isGameHiddenByBlacklist(core, scoreHideLeagues, scoreHideTeams)
      ? "onMarkRead"
      : "always";
  })();

  return computeScoreDisplay(core, revealed, snapshot, effectiveMode);
}

"use client";

import { useCallback } from "react";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { computeScoreDisplay, pickSnapshot } from "@/lib/score-display";
import { isGameHiddenByBlacklist } from "@/lib/score-hide";

export interface SpoilerGateResult {
  revealed: boolean;
  homeScore: string | null;
  awayScore: string | null;
  reveal: () => void;
  hide: () => void;
  acceptUpdate: () => void;
  hasUpdate: boolean;
  canToggle: boolean;
  frozen: boolean;
  statusCategory: "live" | "live-updated" | "final" | "pregame" | "other";
}

export function useSpoilerGate(gameId: number): SpoilerGateResult | null {
  const core = useGameData((s) => s.getCore(gameId));
  const isRevealed = useReveal((s) => s.isRevealed(gameId));
  const snapshot = useReveal((s) => s.getSnapshot(gameId));
  const revealAction = useReveal((s) => s.reveal);
  const hideAction = useReveal((s) => s.hide);
  const acceptUpdateAction = useReveal((s) => s.acceptUpdate);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const scoreHideLeagues = useSettings((s) => s.scoreHideLeagues);
  const scoreHideTeams = useSettings((s) => s.scoreHideTeams);
  const followingLive = useSettings((s) => s.followingLive);

  const reveal = useCallback(() => {
    if (!core) return;
    revealAction(gameId, pickSnapshot(core));
  }, [core, gameId, revealAction]);

  const hide = useCallback(() => {
    hideAction(gameId);
  }, [gameId, hideAction]);

  const acceptUpdate = useCallback(() => {
    if (!core) return;
    acceptUpdateAction(gameId, pickSnapshot(core));
  }, [core, gameId, acceptUpdateAction]);

  if (!core) return null;

  const effectiveMode = resolveEffectiveMode(
    followingLive,
    scoreRevealMode,
    core,
    scoreHideLeagues,
    scoreHideTeams,
  );

  const display = computeScoreDisplay(core, isRevealed, snapshot, effectiveMode);

  return {
    revealed: display.visible,
    homeScore: display.homeScore != null ? String(display.homeScore) : null,
    awayScore: display.awayScore != null ? String(display.awayScore) : null,
    reveal,
    hide,
    acceptUpdate,
    hasUpdate: display.hasUpdate,
    canToggle: display.canToggle,
    frozen: display.frozen,
    statusCategory: display.statusCategory,
  };
}

function resolveEffectiveMode(
  followingLive: boolean,
  scoreRevealMode: "always" | "onMarkRead" | "blacklist",
  core: GameCore,
  scoreHideLeagues: string[],
  scoreHideTeams: string[],
): "always" | "onMarkRead" {
  if (followingLive) return "always";
  if (scoreRevealMode !== "blacklist") return scoreRevealMode;
  return isGameHiddenByBlacklist(core, scoreHideLeagues, scoreHideTeams)
    ? "onMarkRead"
    : "always";
}

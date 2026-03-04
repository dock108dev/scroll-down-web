import type { GameCore } from "@/stores/game-data";
import type { RevealSnapshot } from "@/stores/reveal";
import type { GameStatus } from "@/lib/types";
import { isLive, isFinal, isPregame } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────

export interface ScoreDisplayResult {
  visible: boolean;
  homeScore: number | null;
  awayScore: number | null;
  frozen: boolean;
  hasUpdate: boolean;
  canToggle: boolean;
  statusCategory: "live" | "live-updated" | "final" | "pregame" | "other";
}

// ─── differs() — strict and stable ───────────────────────────────

export function differs(
  core: { homeScore: number | null; awayScore: number | null; status: GameStatus; gameClock?: string; currentPeriod?: number },
  snap: RevealSnapshot,
): boolean {
  return (
    (core.homeScore ?? -1) !== snap.homeScore ||
    (core.awayScore ?? -1) !== snap.awayScore ||
    core.status !== snap.status ||
    (core.gameClock ?? "") !== (snap.clock ?? "") ||
    (core.currentPeriod ?? -1) !== (snap.period ?? -1)
  );
}

// ─── pickSnapshot — create a snapshot from core data ──────────────

export function pickSnapshot(core: GameCore): RevealSnapshot {
  return {
    homeScore: core.homeScore ?? 0,
    awayScore: core.awayScore ?? 0,
    status: core.status,
    clock: core.gameClock,
    period: core.currentPeriod,
    periodLabel: core.currentPeriodLabel,
    snapshotAt: new Date().toISOString(),
  };
}

// ─── computeScoreDisplay — single source of truth ─────────────────

export function computeScoreDisplay(
  core: GameCore,
  revealed: boolean,
  snapshot: RevealSnapshot | undefined,
  scoreRevealMode: "always" | "onMarkRead",
  isActiveView: boolean,
): ScoreDisplayResult {
  const live = isLive(core.status, core);
  const final = isFinal(core.status, core);
  const pregame = isPregame(core.status, core);
  const hasScoreData = core.homeScore != null && core.awayScore != null;
  const canToggle = (final || live) && hasScoreData && scoreRevealMode !== "always";

  // mode=always → render from core (canonical live), never frozen
  if (scoreRevealMode === "always") {
    return {
      visible: !pregame && hasScoreData,
      homeScore: core.homeScore,
      awayScore: core.awayScore,
      frozen: false,
      hasUpdate: false,
      canToggle: false,
      statusCategory: live ? "live" : final ? "final" : pregame ? "pregame" : "other",
    };
  }

  // mode=onMarkRead, not revealed → hidden
  if (!revealed) {
    return {
      visible: false,
      homeScore: null,
      awayScore: null,
      frozen: false,
      hasUpdate: false,
      canToggle,
      statusCategory: live ? "live" : final ? "final" : pregame ? "pregame" : "other",
    };
  }

  // mode=onMarkRead, revealed, active view + LIVE only → auto-accept from core
  // Final games always use snapshot so users can hide/reveal freely on detail page
  if (isActiveView && live) {
    return {
      visible: !pregame && hasScoreData,
      homeScore: core.homeScore,
      awayScore: core.awayScore,
      frozen: false,
      hasUpdate: false,
      canToggle,
      statusCategory: "live",
    };
  }

  // mode=onMarkRead, revealed, NOT active → render from snapshot
  if (snapshot) {
    const hasUpdate = differs(core, snapshot);
    return {
      visible: true,
      homeScore: snapshot.homeScore,
      awayScore: snapshot.awayScore,
      frozen: true,
      hasUpdate,
      canToggle,
      statusCategory: live
        ? hasUpdate ? "live-updated" : "live"
        : final
          ? hasUpdate ? "live-updated" : "final"
          : pregame ? "pregame" : "other",
    };
  }

  // Revealed but no snapshot (e.g. migrated from old format) — show from core
  return {
    visible: !pregame && hasScoreData,
    homeScore: core.homeScore,
    awayScore: core.awayScore,
    frozen: false,
    hasUpdate: false,
    canToggle,
    statusCategory: live ? "live" : final ? "final" : pregame ? "pregame" : "other",
  };
}

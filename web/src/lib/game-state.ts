/**
 * Canonical game state definitions, UI config, and type guards.
 *
 * This module is the single source of truth for game states on the frontend.
 * It mirrors the backend GameState enum exactly.
 */

export const GAME_STATES = [
  "scheduled",
  "pregame",
  "delayed",
  "live",
  "suspended",
  "postponed",
  "final",
  "cancelled",
] as const;

export type GameState = (typeof GAME_STATES)[number];

export interface GameStateUIConfig {
  label: string;
  color: string;
  bgColor: string;
  indicatorType: "none" | "static" | "pulse" | "animated";
  animates: boolean;
}

export const GAME_STATE_UI: Record<GameState, GameStateUIConfig> = {
  scheduled: {
    label: "Scheduled",
    color: "text-neutral-400",
    bgColor: "bg-neutral-800",
    indicatorType: "static",
    animates: false,
  },
  pregame: {
    label: "Starting Soon",
    color: "text-yellow-400",
    bgColor: "bg-yellow-900/30",
    indicatorType: "pulse",
    animates: true,
  },
  delayed: {
    label: "Delayed",
    color: "text-amber-400",
    bgColor: "bg-amber-900/30",
    indicatorType: "pulse",
    animates: true,
  },
  live: {
    label: "Live",
    color: "text-green-400",
    bgColor: "bg-green-900/30",
    indicatorType: "animated",
    animates: true,
  },
  suspended: {
    label: "Suspended",
    color: "text-amber-400",
    bgColor: "bg-amber-900/30",
    indicatorType: "pulse",
    animates: true,
  },
  postponed: {
    label: "Postponed",
    color: "text-neutral-500",
    bgColor: "bg-neutral-800/50",
    indicatorType: "none",
    animates: false,
  },
  final: {
    label: "Final",
    color: "text-neutral-300",
    bgColor: "bg-neutral-800",
    indicatorType: "none",
    animates: false,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-neutral-500",
    bgColor: "bg-neutral-800/50",
    indicatorType: "none",
    animates: false,
  },
};

// ─── Type Guards ────────────────────────────────────────

export function isGameState(value: string): value is GameState {
  return (GAME_STATES as readonly string[]).includes(value);
}

export function isLive(state: GameState): boolean {
  return state === "live";
}

export function isFinal(state: GameState): boolean {
  return state === "final";
}

export function isScheduled(state: GameState): boolean {
  return state === "scheduled";
}

export function isPregame(state: GameState): boolean {
  return state === "pregame";
}

export function isDelayed(state: GameState): boolean {
  return state === "delayed";
}

export function isSuspended(state: GameState): boolean {
  return state === "suspended";
}

export function isPostponed(state: GameState): boolean {
  return state === "postponed";
}

export function isCancelled(state: GameState): boolean {
  return state === "cancelled";
}

export function isTerminal(state: GameState): boolean {
  return state === "final" || state === "cancelled";
}

export function isActive(state: GameState): boolean {
  return state === "live" || state === "suspended" || state === "delayed";
}

export function isPending(state: GameState): boolean {
  return state === "scheduled" || state === "pregame";
}

export function shouldShowScore(state: GameState): boolean {
  return state === "live" || state === "final";
}

// ─── Legacy Compatibility ───────────────────────────────

const LEGACY_TO_CANONICAL: Record<string, GameState> = {
  scheduled: "scheduled",
  pregame: "pregame",
  pre_game: "pregame",
  created: "scheduled",
  delayed: "delayed",
  live: "live",
  in_progress: "live",
  halftime: "live",
  suspended: "suspended",
  postponed: "postponed",
  final: "final",
  completed: "final",
  official: "final",
  archived: "final",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function toCanonicalState(raw: string): GameState {
  const canonical = LEGACY_TO_CANONICAL[raw.toLowerCase().trim()];
  if (canonical) return canonical;
  return "scheduled";
}

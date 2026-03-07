import type { PitchProbabilities } from "../../../types";

export type PitchOutcome =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "in_play";

export type AnimationPhase =
  | "idle"
  | "windup"
  | "release"
  | "travel"
  | "result";

export const OUTCOME_LABELS: Record<PitchOutcome, string> = {
  ball: "Ball",
  called_strike: "Called Strike",
  swinging_strike: "Swinging Strike",
  foul: "Foul Ball",
  in_play: "In Play",
};

export const OUTCOME_COLORS: Record<PitchOutcome, string> = {
  ball: "#60a5fa",
  called_strike: "#f87171",
  swinging_strike: "#fb923c",
  foul: "#a78bfa",
  in_play: "#34d399",
};

export interface OutcomeInfo {
  outcome: PitchOutcome;
  batterSwings: boolean;
  ballInZone: boolean;
}

const SWING_OUTCOMES = new Set<PitchOutcome>([
  "swinging_strike",
  "foul",
  "in_play",
]);

const ZONE_OUTCOMES = new Set<PitchOutcome>([
  "called_strike",
  "swinging_strike",
  "foul",
  "in_play",
]);

export function sampleOutcome(probs: PitchProbabilities): PitchOutcome {
  const r = Math.random();
  let cumulative = 0;

  const entries: [PitchOutcome, number][] = [
    ["ball", probs.ball],
    ["called_strike", probs.called_strike],
    ["swinging_strike", probs.swinging_strike],
    ["foul", probs.foul],
    ["in_play", probs.in_play],
  ];

  for (const [outcome, prob] of entries) {
    cumulative += prob;
    if (r <= cumulative) return outcome;
  }

  return "ball";
}

export function getOutcomeInfo(outcome: PitchOutcome): OutcomeInfo {
  return {
    outcome,
    batterSwings: SWING_OUTCOMES.has(outcome),
    ballInZone: ZONE_OUTCOMES.has(outcome),
  };
}

// Timeline (ms)
export const TIMING = {
  WINDUP_START: 0,
  WINDUP_DURATION: 400,
  RELEASE: 400,
  TRAVEL_START: 400,
  TRAVEL_DURATION: 600,
  PLATE_ARRIVE: 1000,
  SWING_START: 950,
  SWING_DURATION: 150,
  RESULT_SHOW: 1200,
  TOTAL: 1800,
};

import { useEffect, useReducer, useState } from "react";
import type { PlayAnimationProfile } from "./types";

/**
 * Per-play animation phases. The card walks through these in order; some
 * profiles skip phases that don't apply (a walk skips ball-path, a stolen
 * base skips pitch + trigger, etc.).
 *
 *  bridge  — card mounts showing the previous card's ENDING state (outs,
 *            runners, score). Animates to this card's situationBefore by
 *            the end of the phase. Skipped when no priorAfter is attached.
 *  setup   — situation is shown, no movement yet (the "take it in" beat)
 *  pitch   — pitch dot travels mound → home
 *  trigger — contact / walk / strikeout flash at home plate
 *  ball    — ball trail draws toward the fielded zone
 *  runners — runners cross-fade base lights, dots animate base→base, outs blink
 *  settle  — everything holds in its final state (no narrative yet)
 *  reveal  — narrative fades in, then the scroll cue
 *
 * `idle` is the off-screen state. `reveal` is the terminal state.
 */
export type PlayPhase =
  | "idle"
  | "bridge"
  | "setup"
  | "pitch"
  | "trigger"
  | "ball"
  | "runners"
  | "settle"
  | "reveal";

/** Duration (ms) of each phase. A duration of 0 means the phase is skipped
 *  for this profile (no time spent there). */
export interface PhaseSchedule {
  bridge: number;
  setup: number;
  pitch: number;
  trigger: number;
  ball: number;
  runners: number;
  settle: number;
}

/** Absolute milestone times (ms from card-active) for each phase START.
 *  `reveal` is the moment the description fades in; `total` is the end of
 *  the whole beat including a small chevron-pause after `reveal`. */
export interface PhaseMilestones {
  bridge: number;
  setup: number;
  pitch: number;
  trigger: number;
  ball: number;
  runners: number;
  settle: number;
  reveal: number;
  /** When the scroll cue (chevron) fades in — slightly after reveal. */
  ready: number;
  total: number;
}

/** Pause between description fade-in and the scroll-cue chevron appearing. */
const REVEAL_TO_READY_MS = 320;

const DEFAULT: PhaseSchedule = {
  bridge: 0,
  setup: 800,
  pitch: 460,
  trigger: 380,
  ball: 600,
  runners: 800,
  settle: 900,
};

/**
 * Per-profile schedule. Big plays (home runs, double plays) get longer
 * trigger/ball/runners beats so the choreography reads. Walks/HBP/SB
 * skip ball entirely (no ball path) and skip or compress trigger.
 *
 * Bridge defaults to 0 here — the card-level layer sets it to ~440ms when
 * `priorAfter` is attached, otherwise the card mounts straight into setup.
 */
const SCHEDULES: Record<PlayAnimationProfile, PhaseSchedule> = {
  home_run:             { bridge: 0, setup: 900, pitch: 500, trigger: 500, ball: 1100, runners: 1100, settle: 1100 },
  deep_fly:             { bridge: 0, setup: 800, pitch: 460, trigger: 420, ball: 900,  runners: 800,  settle: 800  },
  shallow_fly:          { bridge: 0, setup: 800, pitch: 460, trigger: 380, ball: 700,  runners: 700,  settle: 900},
  line_drive:           { bridge: 0, setup: 800, pitch: 460, trigger: 380, ball: 600,  runners: 700,  settle: 900},
  popup:                { bridge: 0, setup: 800, pitch: 460, trigger: 380, ball: 500,  runners: 500,  settle: 900},
  routine_grounder:     { bridge: 0, setup: 800, pitch: 460, trigger: 340, ball: 500,  runners: 700,  settle: 900},
  hard_grounder:        { bridge: 0, setup: 800, pitch: 460, trigger: 360, ball: 480,  runners: 700,  settle: 900},
  foul:                 { bridge: 0, setup: 800, pitch: 460, trigger: 320, ball: 400,  runners: 0,    settle: 600  },
  walk:                 { bridge: 0, setup: 900, pitch: 500, trigger: 360, ball: 0,    runners: 700,  settle: 900},
  strikeout:            { bridge: 0, setup: 900, pitch: 500, trigger: 420, ball: 0,    runners: 0,    settle: 900},
  stolen_base:          { bridge: 0, setup: 900, pitch: 0,   trigger: 0,   ball: 0,    runners: 800,  settle: 900},
  wild_pitch:           { bridge: 0, setup: 900, pitch: 500, trigger: 360, ball: 0,    runners: 700,  settle: 900},
  double_play_grounder: { bridge: 0, setup: 800, pitch: 460, trigger: 360, ball: 500,  runners: 1100, settle: 800  },
  double_play_fly:      { bridge: 0, setup: 800, pitch: 460, trigger: 400, ball: 800,  runners: 1100, settle: 800  },
  sacrifice_fly:        { bridge: 0, setup: 800, pitch: 460, trigger: 380, ball: 700,  runners: 800,  settle: 900},
  other:                DEFAULT,
};

/** Default duration of the bridging beat when a priorAfter is attached. */
export const BRIDGE_MS = 440;

export function getPhaseSchedule(
  profile: PlayAnimationProfile | undefined,
  overrides?: Partial<PhaseSchedule>,
): PhaseSchedule {
  const base = SCHEDULES[profile ?? "other"] ?? DEFAULT;
  return overrides ? { ...base, ...overrides } : base;
}

export function getPhaseMilestones(
  profile: PlayAnimationProfile | undefined,
  overrides?: Partial<PhaseSchedule>,
): PhaseMilestones {
  const s = getPhaseSchedule(profile, overrides);
  const bridge = 0;
  const setup = bridge + s.bridge;
  const pitch = setup + s.setup;
  const trigger = pitch + s.pitch;
  const ball = trigger + s.trigger;
  const runners = ball + s.ball;
  const settle = runners + s.runners;
  const reveal = settle + s.settle;
  const ready = reveal + REVEAL_TO_READY_MS;
  return {
    bridge,
    setup,
    pitch,
    trigger,
    ball,
    runners,
    settle,
    reveal,
    ready,
    total: ready,
  };
}

type PhaseAction =
  | { type: "start"; to: PlayPhase }
  | { type: "advance"; to: PlayPhase };

interface PhaseState {
  runId: number;
  phase: PlayPhase;
}

function phaseReducer(state: PhaseState, action: PhaseAction): PhaseState {
  switch (action.type) {
    case "start":
      return { runId: state.runId + 1, phase: action.to };
    case "advance":
      return { ...state, phase: action.to };
  }
}

/**
 * Drives the phase state machine. Returns the current phase, plus a
 * `runId` that increments every time the card re-activates (use it to
 * reset CSS animations by passing it as a `key`).
 *
 * On reduced-motion the schedule is collapsed: the card jumps straight
 * to `reveal` so the description and chevron appear immediately.
 */
export function usePlayPhase(
  isActive: boolean,
  profile: PlayAnimationProfile | undefined,
  overrides?: Partial<PhaseSchedule>,
): { phase: PlayPhase; runId: number; milestones: PhaseMilestones } {
  // Initial phase depends on whether a bridge beat is configured. When
  // bridge > 0 the card mounts in `bridge` (showing prior state) and
  // promotes to `setup` after the bridge timer fires.
  const initialPhase: PlayPhase = (overrides?.bridge ?? 0) > 0 ? "bridge" : "setup";
  const [state, dispatch] = useReducer(phaseReducer, { runId: 0, phase: initialPhase });
  const reduceMotion = usePrefersReducedMotion();
  const milestones = getPhaseMilestones(profile, overrides);
  const hasBridge = (overrides?.bridge ?? 0) > 0;

  useEffect(() => {
    if (!isActive) return;

    // Each activation begins with a fresh run + setup (or bridge) phase.
    // Deferring to setTimeout(0) keeps the dispatch out of the synchronous
    // effect body (which would trigger react-hooks/set-state-in-effect).
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => dispatch({ type: "start", to: hasBridge ? "bridge" : "setup" }), 0));

    if (reduceMotion) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "reveal" }), 1));
      return () => timers.forEach(clearTimeout);
    }

    // Schedule phase transitions. Skip phases whose duration is 0
    // (collapsed into their successor).
    if (hasBridge && milestones.setup > milestones.bridge) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "setup" }), milestones.setup));
    }
    if (milestones.pitch > milestones.setup) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "pitch" }), milestones.pitch));
    }
    if (milestones.trigger > milestones.pitch) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "trigger" }), milestones.trigger));
    }
    if (milestones.ball > milestones.trigger) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "ball" }), milestones.ball));
    }
    if (milestones.runners > milestones.ball) {
      timers.push(setTimeout(() => dispatch({ type: "advance", to: "runners" }), milestones.runners));
    }
    timers.push(setTimeout(() => dispatch({ type: "advance", to: "settle" }), milestones.settle));
    timers.push(setTimeout(() => dispatch({ type: "advance", to: "reveal" }), milestones.reveal));

    return () => timers.forEach(clearTimeout);
    // milestones is derived from `profile`; depending on each milestone
    // explicitly avoids a stale closure when the profile changes mid-flight.
  }, [
    isActive,
    reduceMotion,
    hasBridge,
    milestones.bridge,
    milestones.setup,
    milestones.pitch,
    milestones.trigger,
    milestones.ball,
    milestones.runners,
    milestones.settle,
    milestones.reveal,
  ]);

  // Derive "idle" from prop — when not active, ignore the lingering
  // progressed phase from the previous run.
  const phase: PlayPhase = isActive ? state.phase : "idle";
  return { phase, runId: state.runId, milestones };
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduce;
}

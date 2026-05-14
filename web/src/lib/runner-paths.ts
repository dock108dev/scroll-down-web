/**
 * Runner basepath routing — turns a (from, to) pair into the ORDERED list
 * of bases the runner actually touches. A runner from first to home goes
 * first → second → third → home, not in a straight line.
 *
 * The core invariant: runners always travel forward through BASE_ORDER.
 * Going backward is impossible in a regular play.
 */

import type { PlayEventType, RunnerAdvance, RunnerMovementStyle } from "./types";
import { FIELD_POINTS, type BaseName, type Point } from "./field-geometry";

/** Forward-traversal order around the diamond. */
export const BASE_ORDER: readonly BaseName[] = ["home", "first", "second", "third"];

/** Number of segments in a base path — used for duration scaling. */
export function pathSegmentCount(from: BaseName, to: BaseName | "out"): number {
  if (to === "out") return 0;
  return getBasepathRoute(from, to).length - 1;
}

/**
 * Return the ordered list of basepath waypoints from `from` to `to`,
 * inclusive on both ends. A home-run batter goes home → first → second →
 * third → home (5 points / 4 segments). A runner from second to home goes
 * second → third → home (3 points / 2 segments).
 */
export function getBasepathRoute(from: BaseName, to: BaseName): Point[] {
  // No movement.
  if (from === to && from !== "home") {
    return [FIELD_POINTS[from]];
  }

  // Special case: home → home means a full lap (home run for the batter).
  if (from === "home" && to === "home") {
    return [
      FIELD_POINTS.home,
      FIELD_POINTS.first,
      FIELD_POINTS.second,
      FIELD_POINTS.third,
      FIELD_POINTS.home,
    ];
  }

  // Walk forward through BASE_ORDER from `from` until we reach `to`.
  // Note this does NOT include the wrap-around for home → home (handled
  // above) — every other case takes at most 4 forward steps.
  const points: Point[] = [FIELD_POINTS[from]];
  let i = BASE_ORDER.indexOf(from);
  // Cap iterations at 4 so a malformed input can't infinite-loop.
  for (let n = 0; n < 4; n++) {
    i = (i + 1) % BASE_ORDER.length;
    const stop = BASE_ORDER[i];
    points.push(FIELD_POINTS[stop]);
    if (stop === to) break;
  }
  return points;
}

/** Emit an SVG path string ("M x y L x y L x y …") for the basepath. */
export function basepathSvgPath(from: BaseName, to: BaseName): string {
  const points = getBasepathRoute(from, to);
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
}

/**
 * Total path length (in viewBox units) along the basepath from `from` to
 * `to`. Used by trail rendering to size stroke-dasharray correctly so the
 * trail draws in lockstep with the runner dot — no premature completion,
 * no trailing "untouched" segment.
 */
export function basepathLength(from: BaseName, to: BaseName): number {
  const points = getBasepathRoute(from, to);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

// ── Movement plan ────────────────────────────────────────
// Layered on top of RunnerAdvance: adds animation timing (begin/dur) and
// resolves runner ordering so HR sequences read correctly (lead runner
// scores first, batter last). The render layer consumes RunnerMovement[]
// and binds them to <animateMotion> elements.

export interface RunnerMovement {
  /** Origin base. "home" means batter. */
  from: BaseName;
  /** Destination base, or "out" for a retired runner. */
  to: BaseName | "out";
  /** Where the runner was tagged, for OUT-with-known-location. */
  outAt?: BaseName;
  /** ms after the runners phase starts when this runner begins moving. */
  beginMs: number;
  /** ms the move takes (proportional to segment count). */
  durationMs: number;
  /** True when this advance ends at home with a run scored. */
  scores: boolean;
  /** Movement class — drives afterimage persistence + arrival pulse. */
  style: RunnerMovementStyle;
  /** Per-style timing knob: how long the trail stroke persists past the
   *  runner before fading to zero. */
  trailFadeMs: number;
  /** Per-style timing knob: ms to pulse the destination as the runner
   *  arrives. 0 = no arrival pulse. */
  arrivalPulseMs: number;
  /** Original advance — preserved for any downstream needs. */
  advance: RunnerAdvance;
}

/**
 * Per-style timing parameters. Tuned to produce four felt-distinct
 * grammars: routine advance, snappy steal, slower walk shuffle, hard
 * mechanical chain on double plays. Tweaking these is the only knob the
 * visual designer touches; everything else is geometry.
 */
const STYLE_TIMING: Record<RunnerMovementStyle, {
  msPerSegment: number;
  staggerMs: number;
  trailFadeMs: number;
  arrivalPulseMs: number;
}> = {
  advance:      { msPerSegment: 380, staggerMs: 220, trailFadeMs: 360, arrivalPulseMs: 240 },
  score:        { msPerSegment: 360, staggerMs: 180, trailFadeMs: 520, arrivalPulseMs: 460 },
  steal:        { msPerSegment: 280, staggerMs: 0,   trailFadeMs: 240, arrivalPulseMs: 220 },
  walk_shuffle: { msPerSegment: 460, staggerMs: 280, trailFadeMs: 200, arrivalPulseMs: 200 },
  double_play:  { msPerSegment: 320, staggerMs: 140, trailFadeMs: 400, arrivalPulseMs: 200 },
  forced_out:   { msPerSegment: 360, staggerMs: 200, trailFadeMs: 320, arrivalPulseMs: 0 },
  tagged_out:   { msPerSegment: 420, staggerMs: 200, trailFadeMs: 400, arrivalPulseMs: 0 },
  in_place_out: { msPerSegment: 0,   staggerMs: 0,   trailFadeMs: 0,   arrivalPulseMs: 0 },
};

/** Map a (RunnerAdvance, eventType) pair to its movement class. The data
 *  model stays event-agnostic — this layer owns the choreography. */
export function classifyRunnerStyle(
  adv: RunnerAdvance,
  eventType?: PlayEventType,
): RunnerMovementStyle {
  if (adv.to === "out") {
    if (!adv.outAt) return "in_place_out";
    if (eventType === "double_play" || eventType === "triple_play") return "double_play";
    if (
      eventType === "fielders_choice" ||
      eventType === "caught_stealing" ||
      eventType === "pickoff"
    ) return "forced_out";
    return "tagged_out";
  }
  if (adv.to === "home") return "score";
  switch (eventType) {
    case "stolen_base":
    case "wild_pitch":
    case "passed_ball":
    case "balk":
      return "steal";
    case "walk":
    case "hit_by_pitch":
    case "catcher_interference":
      return "walk_shuffle";
    case "double_play":
    case "triple_play":
      return "double_play";
    default:
      return "advance";
  }
}

/**
 * Build the runner movement plan. Sorts advances so the lead runner moves
 * first (3rd → home before 2nd → 3rd), assigns a per-runner stagger, and
 * scales duration by basepath segment count.
 *
 * For home runs the stagger is critical — runners should arrive at home in
 * order, not all collapse to the plate at once. For other plays a small
 * stagger still reads better than simultaneous starts.
 *
 * `eventType` selects the per-runner movement class which in turn drives
 * timing, stagger, and afterimage persistence — a steal snaps, a walk
 * shuffles, a DP transfer chains.
 */
export function buildRunnerMovements(
  advances: RunnerAdvance[],
  eventType?: PlayEventType,
): RunnerMovement[] {
  const renderableAdvances = sanitizeRunnerAdvances(advances);
  // Lead-runner ordering: third before second before first before home (batter).
  const order: Record<BaseName, number> = { third: 0, second: 1, first: 2, home: 3 };
  const sorted = [...renderableAdvances].sort((a, b) => {
    const oa = order[a.from] ?? 4;
    const ob = order[b.from] ?? 4;
    if (oa !== ob) return oa - ob;
    // Tiebreak: scoring moves before non-scoring (rare, but stable).
    const sa = a.to === "home" ? 0 : 1;
    const sb = b.to === "home" ? 0 : 1;
    return sa - sb;
  });

  // Stagger walks the SAME style across siblings — pick the dominant
  // (most numerous) style for the play and apply its stagger uniformly.
  // Otherwise a walk_shuffle's 280ms stagger and an advance's 220ms
  // stagger would interleave awkwardly when multiple runners move on a
  // single play (e.g. forced advances on a HBP).
  const dominantStyle = pickDominantStyle(sorted, eventType);
  const sharedStagger = STYLE_TIMING[dominantStyle].staggerMs;

  return sorted.map((adv, i): RunnerMovement => {
    const style = classifyRunnerStyle(adv, eventType);
    const t = STYLE_TIMING[style];
    const segs = adv.to === "out" ? 1 : pathSegmentCount(adv.from, adv.to);
    const durationMs = style === "in_place_out"
      ? 0
      : Math.max(t.msPerSegment, segs * t.msPerSegment);
    return {
      from: adv.from,
      to: adv.to,
      outAt: adv.outAt,
      beginMs: i * sharedStagger,
      durationMs,
      scores: adv.to === "home",
      style,
      trailFadeMs: t.trailFadeMs,
      arrivalPulseMs: t.arrivalPulseMs,
      advance: adv,
    };
  });
}

function sanitizeRunnerAdvances(advances: RunnerAdvance[]): RunnerAdvance[] {
  const seen = new Set<string>();
  const out: RunnerAdvance[] = [];
  for (const adv of advances) {
    if (adv.from === adv.to && adv.from !== "home") continue;
    const runnerKey = adv.runnerId ?? adv.runnerName ?? "unknown";
    const key = `${runnerKey}:${adv.from}:${adv.to}:${adv.outAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(adv);
  }
  return out;
}

function pickDominantStyle(
  advances: RunnerAdvance[],
  eventType?: PlayEventType,
): RunnerMovementStyle {
  const counts = new Map<RunnerMovementStyle, number>();
  for (const adv of advances) {
    const style = classifyRunnerStyle(adv, eventType);
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  let best: RunnerMovementStyle = "advance";
  let bestCount = -1;
  for (const [style, count] of counts) {
    if (count > bestCount) {
      best = style;
      bestCount = count;
    }
  }
  return best;
}

/** Total runners-phase duration needed to complete every movement. Used
 *  to override the schedule when the default isn't long enough (HR). */
export function totalRunnersDurationMs(movements: RunnerMovement[]): number {
  if (movements.length === 0) return 0;
  return movements.reduce(
    (max, m) => Math.max(max, m.beginMs + m.durationMs),
    0,
  );
}

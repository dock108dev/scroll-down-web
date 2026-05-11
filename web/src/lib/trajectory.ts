import type { BallPath } from "./types";
import {
  DIAMOND_CENTER,
  FIELDER_POS,
  FIELD_POINTS,
  WALL_RADIUS,
  type Point,
} from "./field-geometry";

/**
 * Canonical trajectory grammar.
 *
 * Every batted-ball path on the field is built from one of six classes:
 *
 *   ground    — low arc to the named infielder, almost flat
 *   line      — near-straight, slight upward bow, terminates inside the wall
 *   fly       — parabola, peaks above midpoint, lands at outfielder
 *   home_run  — fly trajectory continued past the wall (the ONLY class
 *               whose endpoint lies outside the boundary)
 *   popup     — tall vertical arc; lands near the catcher
 *   foul      — short curve out of fair territory
 *
 * Each class has a default `arcFactor` (perpendicular offset / chord
 * length). A path may override that default and add per-path personality
 * (asymmetric apex, lateral chord bias) to distinguish siblings within a
 * class without per-card hand-tuning. All variation is declared once in
 * `PATH_SPEC`, so the same path name always produces the same SVG `d`
 * string.
 */

export type TrajectoryClass = "ground" | "line" | "fly" | "home_run" | "popup" | "foul";

interface TrajectorySpec {
  class: TrajectoryClass;
  end: Point;
  /** Override the class-level ARC_FACTOR for this specific path. */
  arcFactor?: number;
  /** Slide the arc apex along the chord. 0 = midpoint, negative = lean
   *  toward start (early peak / pull-side), positive = lean toward end.
   *  Keep within [-0.30, +0.20] — beyond that the curve inverts. */
  apexShift?: number;
  /** Push the apex base point along the chord direction (independent of
   *  apexShift, useful for subtle sliced/pulled feel). Fraction of chord.
   *  Keep within [-0.12, +0.12] — beyond that it reads as a glitch. */
  lateralBias?: number;
}

/** ms-friendly perpendicular offset, expressed as a fraction of chord
 *  length. Larger = more arc. Tweaking these values is the ONLY knob the
 *  visual designer touches; everything else is geometry. */
const ARC_FACTOR: Record<TrajectoryClass, number> = {
  ground:   0.04,
  line:     0.10,
  fly:      0.32,
  home_run: 0.30,
  popup:    0.55, // popup uses its own special-case builder; this is unused
  foul:     0.18,
};

/** Distance past the wall (in viewBox units) where a home-run trajectory
 *  ends. Long enough to read as "gone," short enough to stay near the
 *  outfield zone. */
const HOME_RUN_OVERSHOOT = 26;

/** Map every BallPath to its trajectory class + raw endpoint and (where
 *  applicable) per-path personality. The HR endpoint is later projected
 *  past the wall in `buildTrajectory`. Personality values are calibrated
 *  in `.aidlc/research/trajectory-class-personality-options.md`. */
const PATH_SPEC: Partial<Record<BallPath, TrajectorySpec>> = {
  // Infield grounders — terminate at the fielder. 3B/1B are the hardest
  // shots (flattest); SS/2B carry slightly more arc; P is short-hop back.
  ground_3b: { class: "ground", end: FIELDER_POS.third_base,  arcFactor: 0.03, apexShift: -0.25 },
  ground_ss: { class: "ground", end: FIELDER_POS.shortstop,   arcFactor: 0.04, apexShift: -0.18 },
  ground_p:  { class: "ground", end: FIELDER_POS.pitcher,     arcFactor: 0.05, apexShift:  0    },
  ground_2b: { class: "ground", end: FIELDER_POS.second_base, arcFactor: 0.04, apexShift: -0.18 },
  ground_1b: { class: "ground", end: FIELDER_POS.first_base,  arcFactor: 0.03, apexShift: -0.25 },

  // Line drives — laser-flat, peak near the bat (early apex).
  line_left:   { class: "line", end: FIELDER_POS.lf, arcFactor: 0.08, apexShift: -0.20 },
  line_center: { class: "line", end: FIELDER_POS.cf, arcFactor: 0.10, apexShift: -0.15 },
  line_right:  { class: "line", end: FIELDER_POS.rf, arcFactor: 0.08, apexShift: -0.20 },

  // Fly balls — parabola, lands at the outfielder (inside the wall).
  // CF stays symmetric and tall; gap and pull flies peak earlier.
  fly_lf:  { class: "fly", end: FIELDER_POS.lf,  arcFactor: 0.32, apexShift: -0.10, lateralBias: -0.05 },
  fly_lcf: { class: "fly", end: FIELDER_POS.lcf, arcFactor: 0.30, apexShift: -0.06 },
  fly_cf:  { class: "fly", end: FIELDER_POS.cf,  arcFactor: 0.34, apexShift:  0    },
  fly_rcf: { class: "fly", end: FIELDER_POS.rcf, arcFactor: 0.30, apexShift: -0.06 },
  fly_rf:  { class: "fly", end: FIELDER_POS.rf,  arcFactor: 0.32, apexShift: -0.10, lateralBias:  0.05 },

  // Home runs — same outfield zones, but the endpoint is projected
  // past the wall along the same bearing. Pull HR keeps the early peak.
  home_run_left:   { class: "home_run", end: FIELDER_POS.lf, arcFactor: 0.30, apexShift: -0.08 },
  home_run_center: { class: "home_run", end: FIELDER_POS.cf, arcFactor: 0.30, apexShift:  0    },
  home_run_right:  { class: "home_run", end: FIELDER_POS.rf, arcFactor: 0.30, apexShift: -0.08 },

  // Popup + foul use special-case builders below.
  popup:      { class: "popup", end: FIELD_POINTS.home }, // ignored
  foul:       { class: "foul",  end: FIELD_POINTS.home }, // ignored — defaults to left
  foul_left:  { class: "foul",  end: FIELD_POINTS.home }, // ignored
  foul_right: { class: "foul",  end: FIELD_POINTS.home }, // ignored
};

/**
 * Build the SVG `d` string for a BallPath. Returns `null` for paths that
 * don't have a trail (`none`, `pitch`).
 */
export function buildTrajectory(path: BallPath): string | null {
  if (path === "none" || path === "pitch") return null;
  if (path === "popup") return buildPopupPath();
  // Generic `foul` defaults to the left side (the historical behavior).
  // `foul_left` and `foul_right` are explicit and used by the adapter when
  // it can infer direction from the play description.
  if (path === "foul" || path === "foul_left") return buildFoulPath("left");
  if (path === "foul_right") return buildFoulPath("right");

  const spec = PATH_SPEC[path];
  if (!spec) return null;

  const start = FIELD_POINTS.home;
  const end = spec.class === "home_run" ? projectPastWall(spec.end) : spec.end;

  const cp = arcControlPoint(
    start,
    end,
    spec.arcFactor ?? ARC_FACTOR[spec.class],
    spec.apexShift ?? 0,
    spec.lateralBias ?? 0,
  );
  return `M${fmt(start.x)} ${fmt(start.y)} Q${fmt(cp.x)} ${fmt(cp.y)} ${fmt(end.x)} ${fmt(end.y)}`;
}

/** Project a point through the wall: take its bearing from the diamond
 *  center, place a new point at WALL_RADIUS + overshoot along that bearing.
 *  This guarantees HR trails exit the field at exactly the wall angle of
 *  the named outfield zone — no drift between left, center, right. */
function projectPastWall(insidePoint: Point): Point {
  const bearing = Math.atan2(
    DIAMOND_CENTER.y - insidePoint.y,
    insidePoint.x - DIAMOND_CENTER.x,
  );
  const r = WALL_RADIUS + HOME_RUN_OVERSHOOT;
  return {
    x: DIAMOND_CENTER.x + r * Math.cos(bearing),
    y: DIAMOND_CENTER.y - r * Math.sin(bearing),
  };
}

/** Compute a quadratic-Bezier control point that creates a perpendicular
 *  arc rising "upward" (smaller y) from the chord. `apexShift` slides the
 *  base point along the chord (0 = midpoint); `lateralBias` adds a second
 *  along-chord push. With both at 0 the result equals the chord midpoint. */
function arcControlPoint(
  start: Point,
  end: Point,
  factor: number,
  apexShift = 0,
  lateralBias = 0,
): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = 0.5 + apexShift + lateralBias;
  const baseX = start.x + t * dx;
  const baseY = start.y + t * dy;
  // Perpendicular unit vector. Two choices — pick the one with negative
  // y component so the arc bows toward the top of the viewBox.
  let px = -dy / len;
  let py = dx / len;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const offset = factor * len;
  return {
    x: baseX + px * offset,
    y: baseY + py * offset,
  };
}

/** Tall vertical arc terminating just in front of home plate. Built off
 *  the home-plate origin so it reads as "popped straight up over the
 *  catcher" regardless of zone. */
function buildPopupPath(): string {
  const home = FIELD_POINTS.home;
  const apex = { x: home.x, y: home.y - 60 };
  const land = { x: home.x + 6, y: home.y - 6 };
  return `M${fmt(home.x)} ${fmt(home.y)} Q${fmt(apex.x)} ${fmt(apex.y)} ${fmt(land.x)} ${fmt(land.y)}`;
}

/** Short curve into foul territory on the named side. Terminates outside
 *  the basepath/foul line on that side (the canonical "foul into the
 *  stands" gesture). Mirrors across the home-plate x-axis so left and
 *  right reads as a true reflection. */
function buildFoulPath(side: "left" | "right"): string {
  const home = FIELD_POINTS.home;
  const dir = side === "left" ? -1 : 1;
  // Landing point sits past the basepath in foul territory. y is slightly
  // ABOVE home plate (y - 12) so the curve reads as "into the air on the
  // foul side of the line" rather than dribbling behind the catcher.
  const land = { x: home.x + dir * 78, y: home.y - 12 };
  // Control point pushes the apex OUT past the foul line so the bezier
  // visibly arcs into the stands instead of cutting through fair territory.
  // y > home.y keeps the bow on the catcher side of the basepath.
  const cp = { x: home.x + dir * 30, y: home.y + 6 };
  return `M${fmt(home.x)} ${fmt(home.y)} Q${fmt(cp.x)} ${fmt(cp.y)} ${fmt(land.x)} ${fmt(land.y)}`;
}

/** Trim trailing zeros so the emitted path string stays compact and
 *  diff-friendly. */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

// ── Helpers exposed for tests / debug ──────────────────────

export function trajectoryClass(path: BallPath): TrajectoryClass | null {
  if (path === "popup") return "popup";
  if (path === "foul" || path === "foul_left" || path === "foul_right") return "foul";
  const spec = PATH_SPEC[path];
  return spec?.class ?? null;
}

export function trajectoryEndpoint(path: BallPath): Point | null {
  if (
    path === "popup" ||
    path === "foul" ||
    path === "foul_left" ||
    path === "foul_right" ||
    path === "none" ||
    path === "pitch"
  ) {
    return null;
  }
  const spec = PATH_SPEC[path];
  if (!spec) return null;
  return spec.class === "home_run" ? projectPastWall(spec.end) : spec.end;
}

/**
 * Canonical baseball-field geometry. Every visual element on the field —
 * the diamond, foul lines, outfield wall, fielder positions, ball-path
 * trails, runner labels — derives from these constants. There is no other
 * source of field coordinates in the codebase.
 *
 * Coordinates use a 320×320 SVG viewBox. Home plate sits low so the
 * outfield extends upward; the diamond is a true 45° square (each base
 * exactly 80 units in x or y from the center of the diamond).
 *
 * Critical relationships:
 *   - All four bases are equidistant from a single diamond center.
 *   - The wall arc is centered at that same point — diamond center and
 *     wall center MUST agree, otherwise the diamond looks "off-axis."
 *   - Foul-line endpoints are computed: the actual intersection of the
 *     home→1B / home→3B foul lines with the wall circle.
 *   - Fielders sit at fixed positions inside the wall (infielders) or
 *     just in front of it (outfielders).
 */

export type Point = { x: number; y: number };
export type BaseName = "home" | "first" | "second" | "third";
export type FielderName =
  | "pitcher" | "catcher"
  | "third_base" | "shortstop" | "second_base" | "first_base"
  | "lf" | "lcf" | "cf" | "rcf" | "rf";

// ── Diamond ───────────────────────────────────────────────
// Half-side of the diamond (in viewBox units along an axis). 80 keeps the
// field comfortably inside the 320 viewBox.
const HALF_SIDE = 80;

/** Center of the diamond — also the center of the wall arc. */
export const DIAMOND_CENTER: Point = { x: 160, y: 170 };

export const FIELD_POINTS: Record<BaseName | "mound", Point> = {
  home:   { x: DIAMOND_CENTER.x,             y: DIAMOND_CENTER.y + HALF_SIDE },
  first:  { x: DIAMOND_CENTER.x + HALF_SIDE, y: DIAMOND_CENTER.y             },
  second: { x: DIAMOND_CENTER.x,             y: DIAMOND_CENTER.y - HALF_SIDE },
  third:  { x: DIAMOND_CENTER.x - HALF_SIDE, y: DIAMOND_CENTER.y             },
  mound:  { x: DIAMOND_CENTER.x,             y: DIAMOND_CENTER.y             },
};

// ── Outfield wall ─────────────────────────────────────────
// Single circular arc, same center as the diamond. Radius is chosen so the
// wall sits a comfortable distance beyond the bases without leaving the
// viewBox at the foul lines.
export const WALL_RADIUS = 150;

/** Project a point on the wall at angle θ — measured from +x axis,
 *  CCW in math convention (so θ=π/2 is straight up over center field). */
export function pointOnWall(theta: number): Point {
  return {
    x: DIAMOND_CENTER.x + WALL_RADIUS * Math.cos(theta),
    y: DIAMOND_CENTER.y - WALL_RADIUS * Math.sin(theta),
  };
}

/**
 * Intersect the half-line `home + t * dir` (t > 0) with the wall circle.
 * Used to derive foul-line wall endpoints from the basepath direction,
 * guaranteeing that 1B / 3B lie exactly on the foul lines as drawn.
 *
 * Solves: ((home.x + t*dx) - cx)^2 + ((home.y + t*dy) - cy)^2 = R^2.
 */
function lineHitsWall(dir: { x: number; y: number }): Point {
  const home = FIELD_POINTS.home;
  const dx = home.x - DIAMOND_CENTER.x;
  const dy = home.y - DIAMOND_CENTER.y;
  const a = dir.x * dir.x + dir.y * dir.y;
  const b = 2 * (dx * dir.x + dy * dir.y);
  const c = dx * dx + dy * dy - WALL_RADIUS * WALL_RADIUS;
  const disc = b * b - 4 * a * c;
  // Geometry guarantees disc > 0 (home is inside the wall, line exits).
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  return {
    x: home.x + t * dir.x,
    y: home.y + t * dir.y,
  };
}

/** Foul-line wall endpoints — the exact points where the basepath
 *  directions from home through 1B (right) and 3B (left), extended,
 *  meet the wall arc. By construction, both bases lie on these lines. */
export const FOUL_RIGHT: Point = lineHitsWall({
  x: FIELD_POINTS.first.x - FIELD_POINTS.home.x,
  y: FIELD_POINTS.first.y - FIELD_POINTS.home.y,
});
export const FOUL_LEFT: Point = lineHitsWall({
  x: FIELD_POINTS.third.x - FIELD_POINTS.home.x,
  y: FIELD_POINTS.third.y - FIELD_POINTS.home.y,
});

/** Wall angle (math-CCW from +x axis) at FOUL_RIGHT — used by anything
 *  that walks the wall arc (segment generator, fielder positioning). */
export const FOUL_ANGLE_RIGHT = Math.atan2(
  DIAMOND_CENTER.y - FOUL_RIGHT.y,
  FOUL_RIGHT.x - DIAMOND_CENTER.x,
);
export const FOUL_ANGLE_LEFT = Math.atan2(
  DIAMOND_CENTER.y - FOUL_LEFT.y,
  FOUL_LEFT.x - DIAMOND_CENTER.x,
);

// ── Fielders ──────────────────────────────────────────────
// Outfielders ride a circle slightly inside the wall (at radius
// WALL_RADIUS - 18) so they're visibly INSIDE the boundary. Spaced at
// canonical baseball positions — LF at 135°, CF at 90°, RF at 45°,
// gaps at 112.5° / 67.5°.
const OUTFIELD_RADIUS = WALL_RADIUS - 18;

function pointAtAngle(theta: number, radius: number): Point {
  return {
    x: DIAMOND_CENTER.x + radius * Math.cos(theta),
    y: DIAMOND_CENTER.y - radius * Math.sin(theta),
  };
}

const deg = (d: number) => (d * Math.PI) / 180;

export const FIELDER_POS: Record<FielderName, Point> = {
  pitcher:     FIELD_POINTS.mound,
  catcher:     { x: FIELD_POINTS.home.x, y: FIELD_POINTS.home.y + 12 },
  // Visual placements chosen for legibility on the 320×320 grid — not canonical
  // baseball angles. Do not derive via pointAtAngle(); the absolute coords are
  // the honest representation. Trajectory endpoints (PATH_SPEC) bind to these
  // directly — changing a coord moves both the fielder icon and the ball-path terminus.
  third_base:  { x: 100, y: 195 },
  shortstop:   { x: 116, y: 152 },
  second_base: { x: 204, y: 152 },
  first_base:  { x: 220, y: 195 },
  // Outfielders on the inside-the-wall arc.
  lf:  pointAtAngle(deg(135),  OUTFIELD_RADIUS),
  lcf: pointAtAngle(deg(112.5), OUTFIELD_RADIUS),
  cf:  pointAtAngle(deg(90),   OUTFIELD_RADIUS),
  rcf: pointAtAngle(deg(67.5), OUTFIELD_RADIUS),
  rf:  pointAtAngle(deg(45),   OUTFIELD_RADIUS),
};

// ── Outfield wall as segments ─────────────────────────────
// Drawn as ~12 short straight chunks so the boundary reads as a "device
// drawing" rather than a single perfectly smooth glowing arc. An even
// segment count keeps a vertex at dead-center, reinforcing the symmetry.
export const WALL_SEGMENT_COUNT = 12;

export const WALL_SEGMENTS: Array<{ x1: number; y1: number; x2: number; y2: number }> = (() => {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const startAngle = FOUL_ANGLE_LEFT;
  const endAngle = FOUL_ANGLE_RIGHT;
  for (let i = 0; i < WALL_SEGMENT_COUNT; i++) {
    const t1 = startAngle + ((endAngle - startAngle) * i) / WALL_SEGMENT_COUNT;
    const t2 = startAngle + ((endAngle - startAngle) * (i + 1)) / WALL_SEGMENT_COUNT;
    const p1 = pointOnWall(t1);
    const p2 = pointOnWall(t2);
    segs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }
  return segs;
})();

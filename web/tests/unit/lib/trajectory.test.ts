import { describe, expect, it } from "vitest";
import { buildTrajectory, trajectoryClass, trajectoryEndpoint } from "@/lib/trajectory";
import { DIAMOND_CENTER, FIELD_POINTS, WALL_RADIUS } from "@/lib/field-geometry";
import type { BallPath } from "@/lib/types";

const EPS = 0.5; // half a unit of viewBox tolerance for endpoint comparisons

const ALL_PATHS: BallPath[] = [
  "none", "pitch", "foul", "foul_left", "foul_right",
  "home_run_left", "home_run_center", "home_run_right",
  "ground_3b", "ground_ss", "ground_p", "ground_2b", "ground_1b",
  "line_left", "line_center", "line_right",
  "fly_lf", "fly_lcf", "fly_cf", "fly_rcf", "fly_rf",
  "popup",
];

function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function parseFirstMove(d: string): { x: number; y: number } {
  // "M{x} {y} Q..." — extract the M coordinates.
  const m = d.match(/^M\s*([-\d.]+)\s+([-\d.]+)/);
  if (!m) throw new Error(`unparseable path: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

interface QPath {
  start: { x: number; y: number };
  cp: { x: number; y: number };
  end: { x: number; y: number };
}

function parseQ(d: string): QPath {
  const m = d.match(
    /^M\s*([-\d.]+)\s+([-\d.]+)\s+Q\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/,
  );
  if (!m) throw new Error(`unparseable path: ${d}`);
  return {
    start: { x: Number(m[1]), y: Number(m[2]) },
    cp:    { x: Number(m[3]), y: Number(m[4]) },
    end:   { x: Number(m[5]), y: Number(m[6]) },
  };
}

/** Perpendicular distance from the control point to the chord — proxy
 *  for "how high the arc bows." */
function perpOffset(p: QPath): number {
  const { start, end, cp } = p;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs((cp.x - start.x) * dy - (cp.y - start.y) * dx) / len;
}

/** Position of the cp's projection onto the chord, expressed as a
 *  fraction of chord length from start (0 = at start, 1 = at end). */
function chordParameter(p: QPath): number {
  const { start, end, cp } = p;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy || 1;
  return ((cp.x - start.x) * dx + (cp.y - start.y) * dy) / lenSq;
}

describe("trajectory: nullability", () => {
  it("returns null for `none` and `pitch`", () => {
    expect(buildTrajectory("none")).toBeNull();
    expect(buildTrajectory("pitch")).toBeNull();
  });

  it("returns a path string for every other BallPath", () => {
    for (const p of ALL_PATHS) {
      if (p === "none" || p === "pitch") continue;
      const d = buildTrajectory(p);
      expect(typeof d).toBe("string");
      expect(d!.length).toBeGreaterThan(0);
    }
  });
});

describe("trajectory: every batted-ball path starts at home plate", () => {
  it("first move-to coincides with FIELD_POINTS.home", () => {
    for (const p of ALL_PATHS) {
      if (p === "none" || p === "pitch") continue;
      const d = buildTrajectory(p)!;
      const start = parseFirstMove(d);
      expect(Math.abs(start.x - FIELD_POINTS.home.x)).toBeLessThan(EPS);
      expect(Math.abs(start.y - FIELD_POINTS.home.y)).toBeLessThan(EPS);
    }
  });
});

describe("trajectory: class invariants", () => {
  it("ground / line / fly / popup endpoints are inside the wall", () => {
    const insidePaths: BallPath[] = [
      "ground_3b", "ground_ss", "ground_p", "ground_2b", "ground_1b",
      "line_left", "line_center", "line_right",
      "fly_lf", "fly_lcf", "fly_cf", "fly_rcf", "fly_rf",
    ];
    for (const p of insidePaths) {
      const end = trajectoryEndpoint(p);
      expect(end).not.toBeNull();
      const d = Math.sqrt(distSq(end!, DIAMOND_CENTER));
      expect(d).toBeLessThan(WALL_RADIUS - 0.5);
    }
  });

  it("home-run endpoints are PAST the wall — and only home-run", () => {
    const hrPaths: BallPath[] = ["home_run_left", "home_run_center", "home_run_right"];
    for (const p of hrPaths) {
      const end = trajectoryEndpoint(p);
      expect(end).not.toBeNull();
      const d = Math.sqrt(distSq(end!, DIAMOND_CENTER));
      expect(d).toBeGreaterThan(WALL_RADIUS);
    }
  });

  it("home-run endpoints sit at the same fixed distance past the wall (no drift)", () => {
    const hrPaths: BallPath[] = ["home_run_left", "home_run_center", "home_run_right"];
    const distances = hrPaths.map((p) => {
      const end = trajectoryEndpoint(p)!;
      return Math.sqrt(distSq(end, DIAMOND_CENTER));
    });
    for (let i = 1; i < distances.length; i++) {
      expect(Math.abs(distances[i] - distances[0])).toBeLessThan(1e-6);
    }
  });
});

describe("trajectory: per-path personality", () => {
  it("fly_lf and fly_rf peak before the chord midpoint; fly_cf peaks at midpoint", () => {
    const lf = parseQ(buildTrajectory("fly_lf")!);
    const cf = parseQ(buildTrajectory("fly_cf")!);
    const rf = parseQ(buildTrajectory("fly_rf")!);
    expect(chordParameter(lf)).toBeLessThan(0.5);
    expect(chordParameter(rf)).toBeLessThan(0.5);
    expect(chordParameter(cf)).toBeCloseTo(0.5, 2);
  });

  it("line drives bow far less than fly balls of comparable chord", () => {
    const lineLeft = parseQ(buildTrajectory("line_left")!);
    const flyLeft  = parseQ(buildTrajectory("fly_lf")!);
    expect(perpOffset(lineLeft)).toBeLessThan(perpOffset(flyLeft) * 0.5);
  });

  it("ground balls to 3B / 1B sit flatter than ground balls to SS / 2B", () => {
    // Compare arcFactor effect by normalizing perp offset against chord length.
    const norm = (p: ReturnType<typeof parseQ>) => {
      const dx = p.end.x - p.start.x;
      const dy = p.end.y - p.start.y;
      return perpOffset(p) / Math.hypot(dx, dy);
    };
    const g3 = norm(parseQ(buildTrajectory("ground_3b")!));
    const g1 = norm(parseQ(buildTrajectory("ground_1b")!));
    const gss = norm(parseQ(buildTrajectory("ground_ss")!));
    const g2 = norm(parseQ(buildTrajectory("ground_2b")!));
    expect(g3).toBeLessThan(gss);
    expect(g1).toBeLessThan(g2);
  });

  it("every emitted path string is free of NaN / undefined / Infinity", () => {
    for (const p of ALL_PATHS) {
      if (p === "none" || p === "pitch") continue;
      const d = buildTrajectory(p)!;
      expect(d).not.toMatch(/NaN|undefined|Infinity/i);
      // every numeric token parses to a finite number
      const tokens = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
      expect(tokens.length).toBeGreaterThan(0);
      for (const t of tokens) expect(Number.isFinite(Number(t))).toBe(true);
    }
  });
});

describe("trajectory: classification table is complete", () => {
  it("classifies every batted-ball path", () => {
    const expected: Array<[BallPath, string]> = [
      ["ground_3b", "ground"], ["ground_ss", "ground"], ["ground_p", "ground"],
      ["ground_2b", "ground"], ["ground_1b", "ground"],
      ["line_left", "line"], ["line_center", "line"], ["line_right", "line"],
      ["fly_lf", "fly"], ["fly_lcf", "fly"], ["fly_cf", "fly"],
      ["fly_rcf", "fly"], ["fly_rf", "fly"],
      ["home_run_left", "home_run"], ["home_run_center", "home_run"], ["home_run_right", "home_run"],
      ["popup", "popup"],
      ["foul", "foul"], ["foul_left", "foul"], ["foul_right", "foul"],
    ];
    for (const [p, cls] of expected) {
      expect(trajectoryClass(p)).toBe(cls);
    }
  });
});

describe("trajectory: directional fouls", () => {
  it("foul_left lands LEFT of home plate; foul_right lands RIGHT", () => {
    const left = buildTrajectory("foul_left")!;
    const right = buildTrajectory("foul_right")!;
    const leftEnd = parseFinalPoint(left);
    const rightEnd = parseFinalPoint(right);
    // Home plate x = 160 in the canonical viewBox.
    expect(leftEnd.x).toBeLessThan(160);
    expect(rightEnd.x).toBeGreaterThan(160);
  });

  it("foul and foul_left produce identical SVG paths (backward-compat default)", () => {
    expect(buildTrajectory("foul")).toBe(buildTrajectory("foul_left"));
  });

  it("foul_right is the mirror image of foul_left across home-plate's x-axis", () => {
    const left = parseFinalPoint(buildTrajectory("foul_left")!);
    const right = parseFinalPoint(buildTrajectory("foul_right")!);
    expect(left.y).toBeCloseTo(right.y, 5);
    expect(160 - left.x).toBeCloseTo(right.x - 160, 5);
  });
});

function parseFinalPoint(d: string): { x: number; y: number } {
  // Quadratic bezier — final pair after Q is the endpoint.
  const m = d.match(/Q\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)/);
  if (!m) throw new Error(`unparseable path: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

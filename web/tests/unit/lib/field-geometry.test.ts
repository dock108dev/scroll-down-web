import { describe, expect, it } from "vitest";
import {
  DIAMOND_CENTER,
  FIELDER_POS,
  FIELD_POINTS,
  FOUL_LEFT,
  FOUL_RIGHT,
  FOUL_ANGLE_LEFT,
  FOUL_ANGLE_RIGHT,
  WALL_RADIUS,
  WALL_SEGMENTS,
  pointOnWall,
} from "@/lib/field-geometry";

const EPS = 1e-6;

/** Squared distance between two points. */
function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

describe("field-geometry: diamond invariants", () => {
  it("home/first/second/third are equidistant from the diamond center", () => {
    const targets: Array<keyof typeof FIELD_POINTS> = ["home", "first", "second", "third"];
    const distances = targets.map((k) => Math.sqrt(distSq(FIELD_POINTS[k], DIAMOND_CENTER)));
    const ref = distances[0];
    for (const d of distances) {
      expect(Math.abs(d - ref)).toBeLessThan(1e-6);
    }
  });
});

describe("field-geometry: foul-line geometry", () => {
  it("first base lies exactly on the right foul line (home → 1B → wall)", () => {
    // Slope from home to 1B and home to FOUL_RIGHT must be identical.
    const home = FIELD_POINTS.home;
    const first = FIELD_POINTS.first;
    const slopeBase = (first.y - home.y) / (first.x - home.x);
    const slopeWall = (FOUL_RIGHT.y - home.y) / (FOUL_RIGHT.x - home.x);
    expect(Math.abs(slopeBase - slopeWall)).toBeLessThan(EPS);
  });

  it("third base lies exactly on the left foul line (home → 3B → wall)", () => {
    const home = FIELD_POINTS.home;
    const third = FIELD_POINTS.third;
    const slopeBase = (third.y - home.y) / (third.x - home.x);
    const slopeWall = (FOUL_LEFT.y - home.y) / (FOUL_LEFT.x - home.x);
    expect(Math.abs(slopeBase - slopeWall)).toBeLessThan(EPS);
  });

  it("both foul wall points sit on the wall arc", () => {
    const dRight = Math.sqrt(distSq(FOUL_RIGHT, DIAMOND_CENTER));
    const dLeft = Math.sqrt(distSq(FOUL_LEFT, DIAMOND_CENTER));
    expect(Math.abs(dRight - WALL_RADIUS)).toBeLessThan(1e-6);
    expect(Math.abs(dLeft - WALL_RADIUS)).toBeLessThan(1e-6);
  });

  it("foul angles are mirror-symmetric across the y-axis through center", () => {
    // Right angle is small positive; left angle is π − right.
    expect(FOUL_ANGLE_RIGHT).toBeGreaterThan(0);
    expect(FOUL_ANGLE_LEFT).toBeGreaterThan(0);
    expect(Math.abs(FOUL_ANGLE_LEFT - (Math.PI - FOUL_ANGLE_RIGHT))).toBeLessThan(EPS);
  });
});

describe("field-geometry: wall segments", () => {
  it("first segment starts at FOUL_LEFT and last segment ends at FOUL_RIGHT", () => {
    const first = WALL_SEGMENTS[0];
    const last = WALL_SEGMENTS[WALL_SEGMENTS.length - 1];
    expect(Math.abs(first.x1 - FOUL_LEFT.x)).toBeLessThan(1e-6);
    expect(Math.abs(first.y1 - FOUL_LEFT.y)).toBeLessThan(1e-6);
    expect(Math.abs(last.x2 - FOUL_RIGHT.x)).toBeLessThan(1e-6);
    expect(Math.abs(last.y2 - FOUL_RIGHT.y)).toBeLessThan(1e-6);
  });

  it("every wall vertex sits at WALL_RADIUS from center", () => {
    for (const s of WALL_SEGMENTS) {
      const d1 = Math.sqrt(distSq({ x: s.x1, y: s.y1 }, DIAMOND_CENTER));
      const d2 = Math.sqrt(distSq({ x: s.x2, y: s.y2 }, DIAMOND_CENTER));
      expect(Math.abs(d1 - WALL_RADIUS)).toBeLessThan(1e-6);
      expect(Math.abs(d2 - WALL_RADIUS)).toBeLessThan(1e-6);
    }
  });
});

describe("field-geometry: outfielder positions", () => {
  it("LF and RF are mirror-symmetric across center", () => {
    const dxL = FIELDER_POS.lf.x - DIAMOND_CENTER.x;
    const dxR = FIELDER_POS.rf.x - DIAMOND_CENTER.x;
    expect(Math.abs(dxL + dxR)).toBeLessThan(1e-6);
    expect(Math.abs(FIELDER_POS.lf.y - FIELDER_POS.rf.y)).toBeLessThan(1e-6);
  });

  it("CF sits on the y-axis through center", () => {
    expect(Math.abs(FIELDER_POS.cf.x - DIAMOND_CENTER.x)).toBeLessThan(1e-6);
  });

  it("every outfielder is inside the wall", () => {
    for (const key of ["lf", "lcf", "cf", "rcf", "rf"] as const) {
      const d = Math.sqrt(distSq(FIELDER_POS[key], DIAMOND_CENTER));
      expect(d).toBeLessThan(WALL_RADIUS);
    }
  });
});

describe("field-geometry: pointOnWall", () => {
  it("returns a point at WALL_RADIUS from center", () => {
    const samples = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    for (const t of samples) {
      const p = pointOnWall(t);
      const d = Math.sqrt(distSq(p, DIAMOND_CENTER));
      expect(Math.abs(d - WALL_RADIUS)).toBeLessThan(1e-6);
    }
  });
});

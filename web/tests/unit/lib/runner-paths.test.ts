import { describe, expect, it } from "vitest";
import {
  basepathLength,
  basepathSvgPath,
  buildRunnerMovements,
  classifyRunnerStyle,
  getBasepathRoute,
  pathSegmentCount,
  totalRunnersDurationMs,
} from "@/lib/runner-paths";
import type { RunnerAdvance } from "@/lib/types";

describe("classifyRunnerStyle", () => {
  it("classifies a routine single advance as 'advance'", () => {
    expect(classifyRunnerStyle({ from: "home", to: "first" }, "single")).toBe("advance");
  });
  it("classifies a runner crossing home as 'score' regardless of event", () => {
    expect(classifyRunnerStyle({ from: "third", to: "home" }, "single")).toBe("score");
    expect(classifyRunnerStyle({ from: "third", to: "home" }, "sacrifice")).toBe("score");
  });
  it("classifies steal/wild-pitch advances as 'steal'", () => {
    expect(classifyRunnerStyle({ from: "first", to: "second" }, "stolen_base")).toBe("steal");
    expect(classifyRunnerStyle({ from: "first", to: "second" }, "wild_pitch")).toBe("steal");
    expect(classifyRunnerStyle({ from: "first", to: "second" }, "passed_ball")).toBe("steal");
    expect(classifyRunnerStyle({ from: "first", to: "second" }, "balk")).toBe("steal");
  });
  it("classifies walk/HBP/CI advances as 'walk_shuffle'", () => {
    expect(classifyRunnerStyle({ from: "home", to: "first" }, "walk")).toBe("walk_shuffle");
    expect(classifyRunnerStyle({ from: "home", to: "first" }, "hit_by_pitch")).toBe("walk_shuffle");
    expect(classifyRunnerStyle({ from: "home", to: "first" }, "catcher_interference")).toBe("walk_shuffle");
  });
  it("classifies double-play outs as 'double_play'", () => {
    expect(
      classifyRunnerStyle({ from: "first", to: "out", outAt: "second" }, "double_play"),
    ).toBe("double_play");
  });
  it("classifies CS/pickoff/FC outs as 'forced_out'", () => {
    expect(
      classifyRunnerStyle({ from: "first", to: "out", outAt: "second" }, "caught_stealing"),
    ).toBe("forced_out");
    expect(
      classifyRunnerStyle({ from: "first", to: "out", outAt: "first" }, "pickoff"),
    ).toBe("forced_out");
    expect(
      classifyRunnerStyle({ from: "first", to: "out", outAt: "second" }, "fielders_choice"),
    ).toBe("forced_out");
  });
  it("classifies runners out at unspecified location as 'in_place_out'", () => {
    expect(classifyRunnerStyle({ from: "home", to: "out" }, "field_out")).toBe("in_place_out");
  });
  it("classifies tagged out at home as 'tagged_out'", () => {
    expect(
      classifyRunnerStyle({ from: "third", to: "out", outAt: "home" }, "field_out"),
    ).toBe("tagged_out");
  });
});

describe("buildRunnerMovements: per-style timing", () => {
  it("steals have zero stagger so the runner snaps", () => {
    const movements = buildRunnerMovements(
      [{ from: "first", to: "second" }],
      "stolen_base",
    );
    expect(movements[0].style).toBe("steal");
    expect(movements[0].beginMs).toBe(0);
  });
  it("walks shuffle slower than routine advances", () => {
    const walk = buildRunnerMovements(
      [{ from: "home", to: "first" }],
      "walk",
    );
    const single = buildRunnerMovements(
      [{ from: "home", to: "first" }],
      "single",
    );
    expect(walk[0].style).toBe("walk_shuffle");
    expect(single[0].style).toBe("advance");
    expect(walk[0].durationMs).toBeGreaterThan(single[0].durationMs);
  });
  it("scores get the longest trail persistence", () => {
    const score = buildRunnerMovements(
      [{ from: "third", to: "home" }],
      "single",
    );
    const advance = buildRunnerMovements(
      [{ from: "home", to: "first" }],
      "single",
    );
    expect(score[0].style).toBe("score");
    expect(score[0].trailFadeMs).toBeGreaterThan(advance[0].trailFadeMs);
  });
});

describe("basepathLength", () => {
  it("returns the chord length for a single-segment advance", () => {
    // Home (160, 250) → First (240, 170): √(80² + 80²) ≈ 113.14
    const len = basepathLength("home", "first");
    expect(len).toBeCloseTo(80 * Math.SQRT2, 2);
  });
  it("returns 4× the segment length for a HR (home → home full lap)", () => {
    const len = basepathLength("home", "home");
    expect(len).toBeCloseTo(4 * 80 * Math.SQRT2, 2);
  });
});

describe("getBasepathRoute", () => {
  it("returns a single segment for an adjacent advance", () => {
    expect(getBasepathRoute("first", "second")).toHaveLength(2);
    expect(getBasepathRoute("third", "home")).toHaveLength(2);
  });

  it("routes a runner from first to home through every base", () => {
    const route = getBasepathRoute("first", "home");
    // Order is first → second → third → home: 4 waypoints, 3 segments.
    expect(route).toHaveLength(4);
  });

  it("routes a home-run batter through every base back to home", () => {
    const route = getBasepathRoute("home", "home");
    // home → first → second → third → home: 5 waypoints, 4 segments.
    expect(route).toHaveLength(5);
  });

  it("routes a runner from second to home through third", () => {
    expect(getBasepathRoute("second", "home")).toHaveLength(3);
  });
});

describe("pathSegmentCount", () => {
  it("counts segments correctly for common advances", () => {
    expect(pathSegmentCount("home", "first")).toBe(1);
    expect(pathSegmentCount("home", "second")).toBe(2);
    expect(pathSegmentCount("home", "third")).toBe(3);
    expect(pathSegmentCount("home", "home")).toBe(4);
    expect(pathSegmentCount("first", "home")).toBe(3);
    expect(pathSegmentCount("third", "home")).toBe(1);
  });

  it("treats outs as a single segment for duration purposes", () => {
    expect(pathSegmentCount("home", "out")).toBe(0);
  });
});

describe("basepathSvgPath", () => {
  it("emits a multi-segment path for a HR batter", () => {
    const d = basepathSvgPath("home", "home");
    // One M, four L commands.
    const Ls = d.match(/L/g) ?? [];
    expect(d.startsWith("M ")).toBe(true);
    expect(Ls).toHaveLength(4);
  });

  it("emits a single-segment path for an adjacent advance", () => {
    const d = basepathSvgPath("third", "home");
    expect(d.match(/L/g)).toHaveLength(1);
  });
});

describe("buildRunnerMovements (HR sequencing)", () => {
  it("orders runners so the lead runner moves first and batter last", () => {
    // 3-run HR with runners on first and second + batter.
    const advances: RunnerAdvance[] = [
      { from: "second", to: "home" },
      { from: "first", to: "home" },
      { from: "home", to: "home" },
    ];
    const movements = buildRunnerMovements(advances);
    expect(movements.map((m) => m.from)).toEqual(["second", "first", "home"]);
    // Each runner starts after the previous one (stagger > 0).
    expect(movements[0].beginMs).toBe(0);
    expect(movements[1].beginMs).toBeGreaterThan(0);
    expect(movements[2].beginMs).toBeGreaterThan(movements[1].beginMs);
  });

  it("scales duration by basepath segment count", () => {
    const advances: RunnerAdvance[] = [
      { from: "third", to: "home" }, // 1 segment
      { from: "home", to: "home" },  // 4 segments (HR batter)
    ];
    const [third, batter] = buildRunnerMovements(advances);
    expect(batter.durationMs).toBeGreaterThan(third.durationMs);
  });

  it("flags scoring movements", () => {
    const movements = buildRunnerMovements([
      { from: "first", to: "second" },
      { from: "third", to: "home" },
    ]);
    expect(movements.find((m) => m.from === "third")?.scores).toBe(true);
    expect(movements.find((m) => m.from === "first")?.scores).toBe(false);
  });
});

describe("totalRunnersDurationMs", () => {
  it("returns 0 when no movements", () => {
    expect(totalRunnersDurationMs([])).toBe(0);
  });

  it("returns the maximum begin+dur across movements", () => {
    const movements = buildRunnerMovements([
      { from: "third", to: "home" },
      { from: "second", to: "home" },
      { from: "first", to: "home" },
      { from: "home", to: "home" },
    ]);
    const total = totalRunnersDurationMs(movements);
    // Last movement begins last and runs longest — should be the max.
    const last = movements[movements.length - 1];
    expect(total).toBe(last.beginMs + last.durationMs);
  });
});

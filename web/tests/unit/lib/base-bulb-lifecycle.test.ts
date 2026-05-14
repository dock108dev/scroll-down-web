import { describe, it, expect } from "vitest";
import {
  formatRunnerLabel,
  computeBaseBulbLifecycle,
} from "@/lib/base-bulb-lifecycle";

describe("computeBaseBulbLifecycle", () => {
  // Exhaustive table over all 8 (prior, before, after) tuples. The
  // screenshot bug lives in row 7 (T,F,T) — the prior implementation
  // sent that case to a "prior" lifecycle that faded out and never
  // came back, hiding the new runner through the entire play.
  const cases: Array<{
    prior: boolean;
    before: boolean;
    after: boolean;
    expected: ReturnType<typeof computeBaseBulbLifecycle>;
  }> = [
    { prior: false, before: false, after: false, expected: null },
    { prior: false, before: false, after: true,  expected: "arrive" },
    { prior: false, before: true,  after: false, expected: "depart" },
    { prior: false, before: true,  after: true,  expected: "hold" },
    { prior: true,  before: false, after: false, expected: "release" },
    { prior: true,  before: false, after: true,  expected: "swap" },
    { prior: true,  before: true,  after: false, expected: "depart" },
    { prior: true,  before: true,  after: true,  expected: "hold" },
  ];

  for (const { prior, before, after, expected } of cases) {
    it(`prior=${prior} before=${before} after=${after} → ${expected ?? "null"}`, () => {
      expect(computeBaseBulbLifecycle({ prior, before, after })).toBe(expected);
    });
  }

  it("treats undefined prior as equal to before (no bridge attached)", () => {
    // Before-occupied with no bridge — should hold solid, not flicker.
    expect(computeBaseBulbLifecycle({ before: true, after: true })).toBe("hold");
    expect(computeBaseBulbLifecycle({ before: true, after: false })).toBe("depart");
    // Empty before with no bridge and runner arriving — clean arrival.
    expect(computeBaseBulbLifecycle({ before: false, after: true })).toBe("arrive");
    expect(computeBaseBulbLifecycle({ before: false, after: false })).toBe(null);
  });
});

describe("formatRunnerLabel", () => {
  it("returns a stable fallback for undefined / empty / whitespace", () => {
    expect(formatRunnerLabel(undefined)).toBe("RUNNER");
    expect(formatRunnerLabel("")).toBe("RUNNER");
    expect(formatRunnerLabel("   ")).toBe("RUNNER");
  });

  it("formats first initial plus last name", () => {
    expect(formatRunnerLabel("Corbin Carroll")).toBe("C CARROLL");
    expect(formatRunnerLabel("Josh Jung")).toBe("J JUNG");
    expect(formatRunnerLabel("Gabriel Moreno")).toBe("G MORENO");
    expect(formatRunnerLabel("Maxwell Waldschmidt")).toBe("M WALDSCHMIDT");
  });

  it("does not emit last-name-only labels", () => {
    expect(formatRunnerLabel("Edwards")).toBe("RUNNER");
  });

  it("accepts player summary objects", () => {
    expect(formatRunnerLabel({ id: "123", name: "Cedric Mayo" })).toBe("C MAYO");
    expect(formatRunnerLabel({ id: "123", name: "" })).toBe("RUNNER");
  });

  it("uppercases", () => {
    expect(formatRunnerLabel("juan soto")).toBe("J SOTO");
  });
});

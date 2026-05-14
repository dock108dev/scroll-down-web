import { describe, it, expect } from "vitest";
import {
  abbrevRunner,
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

describe("abbrevRunner", () => {
  it("returns empty string for undefined / empty / whitespace", () => {
    expect(abbrevRunner(undefined)).toBe("");
    expect(abbrevRunner("")).toBe("");
    expect(abbrevRunner("   ")).toBe("");
  });

  it("keeps the last whitespace-delimited token", () => {
    expect(abbrevRunner("Xavier Edwards")).toBe("EDWARDS");
    expect(abbrevRunner("Liam Hicks")).toBe("HICKS");
  });

  it("clips to 8 chars without ellipsis", () => {
    expect(abbrevRunner("Vladimir Guerrero")).toBe("GUERRERO");
    expect(abbrevRunner("Bobby Witt-Jr.")).toBe("WITT-JR.");
    // 9-char surname → trimmed, no trailing dots.
    expect(abbrevRunner("Foo Goldschmidt")).toBe("GOLDSCHM");
  });

  it("uppercases", () => {
    expect(abbrevRunner("juan soto")).toBe("SOTO");
  });
});

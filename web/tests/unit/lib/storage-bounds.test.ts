import { describe, it, expect } from "vitest";
import { pruneByAge } from "@/lib/storage-bounds";

describe("pruneByAge", () => {
  it("drops stale entries and caps count", () => {
    const now = Date.now();
    const records = {
      a: { savedAt: new Date(now - 100_000).toISOString(), v: 1 },
      b: { savedAt: new Date(now - 50_000).toISOString(), v: 2 },
      c: { savedAt: new Date(now - 10_000).toISOString(), v: 3 },
    };
    const pruned = pruneByAge(records, 2, 80_000);
    expect(Object.keys(pruned).sort()).toEqual(["b", "c"]);
  });

  it("treats missing savedAt as age 0", () => {
    const pruned = pruneByAge({ x: {} }, 5, 1000);
    expect(pruned.x).toEqual({});
  });
});

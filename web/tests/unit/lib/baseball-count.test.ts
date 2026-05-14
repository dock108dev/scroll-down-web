import { describe, expect, it } from "vitest";
import {
  inferTerminalPitchResult,
  isValidDisplayCount,
  normalizeDisplayCount,
} from "@/lib/baseball-count";

describe("baseball count display normalization", () => {
  it("never returns impossible display counts", () => {
    expect(normalizeDisplayCount({ balls: 4, strikes: 2 })).toEqual({ balls: 3, strikes: 2 });
    expect(normalizeDisplayCount({ balls: 3, strikes: 3 })).toEqual({ balls: 3, strikes: 2 });
    expect(normalizeDisplayCount({ balls: 1, strikes: 3 })).toEqual({ balls: 1, strikes: 2 });
  });

  it("resets terminal after-counts for revealed/next display phases", () => {
    expect(normalizeDisplayCount({ balls: 4, strikes: 2 }, "walk", "revealed")).toEqual({ balls: 0, strikes: 0 });
    expect(normalizeDisplayCount({ balls: 1, strikes: 3 }, "strikeout", "next")).toEqual({ balls: 0, strikes: 0 });
    expect(normalizeDisplayCount({ balls: 0, strikes: 0 }, "ball_in_play", "revealed")).toEqual({ balls: 0, strikes: 0 });
  });

  it("identifies valid display-count limits", () => {
    expect(isValidDisplayCount({ balls: 3, strikes: 2 })).toBe(true);
    expect(isValidDisplayCount({ balls: 4, strikes: 2 })).toBe(false);
    expect(isValidDisplayCount({ balls: 1, strikes: 3 })).toBe(false);
  });

  it("infers terminal pitch result categories from event flags", () => {
    expect(inferTerminalPitchResult("walk", null)).toBe("walk");
    expect(inferTerminalPitchResult("strikeout", null)).toBe("strikeout");
    expect(inferTerminalPitchResult("single", null)).toBe("ball_in_play");
    expect(inferTerminalPitchResult("wild_pitch", null)).toBeUndefined();
  });
});

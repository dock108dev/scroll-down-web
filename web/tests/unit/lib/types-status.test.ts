import { describe, it, expect } from "vitest";
import {
  isLive,
  isFinal,
  isPregame,
  TERMINAL_STATUSES,
  PREGAME_STATUSES,
} from "@/lib/types";

describe("types status helpers", () => {
  it("treats terminal and pregame statuses as not live", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(isLive(status, { isLive: true })).toBe(false);
      expect(isFinal(status)).toBe(true);
    }
    for (const status of PREGAME_STATUSES) {
      expect(isLive(status, { isLive: true })).toBe(false);
      expect(isPregame(status)).toBe(true);
    }
  });

  it("uses explicit game boolean overrides for non-terminal statuses", () => {
    expect(isLive("in_progress", { isLive: true })).toBe(true);
    expect(isLive("in_progress", { isLive: false })).toBe(false);
    expect(isFinal("live", { isFinal: true })).toBe(true);
    expect(isPregame("live", { isPregame: true })).toBe(true);
  });

  it("falls back to status string when no isLive override is given", () => {
    expect(isLive("live")).toBe(true);
    expect(isLive("in_progress")).toBe(true);
    expect(isLive("delayed" as never)).toBe(false);
  });

  it("returns false for isFinal/isPregame on non-terminal status with no override", () => {
    expect(isFinal("live")).toBe(false);
    expect(isPregame("live")).toBe(false);
  });
});

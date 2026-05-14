import { describe, expect, it } from "vitest";
import {
  hasConfidentBattedBallPath,
  shouldShowBattedBallOverlay,
} from "@/components/catchup/BaseballLightField";

// Product rule (BRAINDUMP): never draw fake hit trajectories or guessed
// movement paths. The overlay is gated by three layers — `CatchupCard`
// hardwires `ballPath: "none"` pre-reveal; post-reveal the field gates
// on (a) a confident batted-ball path and (b) the upstream
// `suppressMovementLines` flag.

describe("shouldShowBattedBallOverlay", () => {
  it("draws overlay for a normal hit with no suppression", () => {
    expect(shouldShowBattedBallOverlay("fly_cf", "deep_fly", false)).toBe(true);
    expect(shouldShowBattedBallOverlay("ground_ss", "routine_grounder", undefined)).toBe(true);
    expect(shouldShowBattedBallOverlay("home_run_left", "home_run", false)).toBe(true);
  });

  it("suppresses overlay when suppressMovementLines is true, even for a real batted-ball path", () => {
    // Caught stealing or pickoff cards may carry a residual zone string
    // but the backend tells the renderer not to draw it.
    expect(shouldShowBattedBallOverlay("fly_cf", "deep_fly", true)).toBe(false);
    expect(shouldShowBattedBallOverlay("ground_ss", "routine_grounder", true)).toBe(false);
    expect(shouldShowBattedBallOverlay("home_run_left", "home_run", true)).toBe(false);
  });

  it("suppresses overlay when ballPath is 'none' regardless of suppression flag", () => {
    expect(shouldShowBattedBallOverlay("none", "walk", false)).toBe(false);
    expect(shouldShowBattedBallOverlay("none", "deep_fly", undefined)).toBe(false);
    expect(shouldShowBattedBallOverlay("none", "deep_fly", true)).toBe(false);
  });

  it("suppresses overlay when ballPath is 'pitch' (wild pitch / passed ball)", () => {
    expect(shouldShowBattedBallOverlay("pitch", "wild_pitch", false)).toBe(false);
    expect(shouldShowBattedBallOverlay("pitch", "wild_pitch", undefined)).toBe(false);
  });

  it("suppresses overlay for no-contact animation profiles (walk / strikeout / stolen_base)", () => {
    // Defense-in-depth: even if a stale ballPath somehow paired with a
    // no-contact profile, the value-based gate keeps the overlay off.
    expect(shouldShowBattedBallOverlay("fly_cf", "walk", false)).toBe(false);
    expect(shouldShowBattedBallOverlay("fly_cf", "strikeout", false)).toBe(false);
    expect(shouldShowBattedBallOverlay("fly_cf", "stolen_base", false)).toBe(false);
  });

  it("does not invent suppression when the flag is undefined — defers to ballPath/profile only", () => {
    // Undefined must behave identically to false at this layer; the
    // adapter only sets it when the upstream classifier said true.
    expect(shouldShowBattedBallOverlay("fly_cf", "deep_fly", undefined)).toBe(
      shouldShowBattedBallOverlay("fly_cf", "deep_fly", false),
    );
    expect(shouldShowBattedBallOverlay("none", "walk", undefined)).toBe(
      shouldShowBattedBallOverlay("none", "walk", false),
    );
  });
});

describe("hasConfidentBattedBallPath (pre-suppression layer)", () => {
  it("returns true for hit-zone paths", () => {
    expect(hasConfidentBattedBallPath("fly_lf", "deep_fly")).toBe(true);
    expect(hasConfidentBattedBallPath("line_center", "line_drive")).toBe(true);
    expect(hasConfidentBattedBallPath("popup", "popup")).toBe(true);
    expect(hasConfidentBattedBallPath("foul_left", "foul")).toBe(true);
  });

  it("returns false for 'none' / 'pitch' paths regardless of profile", () => {
    expect(hasConfidentBattedBallPath("none", "deep_fly")).toBe(false);
    expect(hasConfidentBattedBallPath("pitch", "wild_pitch")).toBe(false);
  });

  it("returns false for no-contact profiles regardless of path", () => {
    expect(hasConfidentBattedBallPath("fly_cf", "walk")).toBe(false);
    expect(hasConfidentBattedBallPath("fly_cf", "strikeout")).toBe(false);
    expect(hasConfidentBattedBallPath("fly_cf", "stolen_base")).toBe(false);
  });
});

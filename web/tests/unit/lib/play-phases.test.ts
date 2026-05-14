import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getPhaseMilestones,
  getPhaseSchedule,
  usePlayPhase,
  type PlayPhase,
} from "@/lib/play-phases";
import type { PlayAnimationProfile } from "@/lib/types";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("usePlayPhase — full reveal sequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks preview → revealing → revealed → advance through every milestone", () => {
    const profile: PlayAnimationProfile = "line_drive";
    const milestones = getPhaseMilestones(profile);
    const narrativeRevealDur = 200;

    const { result } = renderHook(() =>
      usePlayPhase(true, profile, undefined, narrativeRevealDur),
    );

    // Initial state — synchronous mount lands on "setup" (no bridge override).
    expect(result.current.phase).toBe<PlayPhase>("setup");

    // Each timed milestone advances the phase. The dispatch is scheduled
    // at the absolute ms offset from card activation.
    const transitions: Array<{ at: number; expected: PlayPhase }> = [
      { at: milestones.pitch, expected: "pitch" },
      { at: milestones.trigger, expected: "trigger" },
      { at: milestones.ball, expected: "ball" },
      { at: milestones.runners, expected: "runners" },
      { at: milestones.settle, expected: "settle" },
      { at: milestones.reveal, expected: "reveal" },
      { at: milestones.reveal + narrativeRevealDur, expected: "advance" },
    ];

    let elapsed = 0;
    for (const step of transitions) {
      const delta = step.at - elapsed;
      act(() => {
        vi.advanceTimersByTime(delta);
      });
      expect(result.current.phase).toBe(step.expected);
      elapsed = step.at;
    }

    // `advance` is terminal — no further dispatches after this point.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.phase).toBe<PlayPhase>("advance");
  });

  it("reaches advance at exactly milestones.reveal when narrativeRevealDurMs is 0", () => {
    const profile: PlayAnimationProfile = "popup";
    const milestones = getPhaseMilestones(profile);

    const { result } = renderHook(() => usePlayPhase(true, profile, undefined, 0));

    // Stop one tick before reveal to confirm we haven't jumped to advance yet.
    act(() => {
      vi.advanceTimersByTime(milestones.reveal - 1);
    });
    expect(result.current.phase).toBe<PlayPhase>("settle");

    // Same-tick dispatch — both reveal and advance timers fire when
    // narrativeRevealDur is 0, so the reducer collapses to advance.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe<PlayPhase>("advance");
  });
});

describe("usePlayPhase — reduced-motion collapse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses setup → reveal → advance within a couple of ticks", () => {
    const { result } = renderHook(() =>
      usePlayPhase(true, "home_run", undefined, 0),
    );

    expect(result.current.phase).toBe<PlayPhase>("setup");

    // Reveal fires at t=1ms in the reduced-motion path.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe<PlayPhase>("reveal");

    // Advance follows immediately at t=2ms — narrative fade-in is collapsed,
    // so there's no animation to wait for.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe<PlayPhase>("advance");

    // Terminal — long elapsed time does not regress or progress beyond
    // advance.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.phase).toBe<PlayPhase>("advance");
  });
});

describe("phase skipping matrix — every profile reaches advance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const profiles: PlayAnimationProfile[] = [
    "home_run",
    "deep_fly",
    "shallow_fly",
    "line_drive",
    "popup",
    "routine_grounder",
    "hard_grounder",
    "foul",
    "walk",
    "strikeout",
    "stolen_base",
    "wild_pitch",
    "double_play_grounder",
    "double_play_fly",
    "sacrifice_fly",
    "rundown",
  ];

  it.each(profiles)("profile %s terminates in advance", (profile) => {
    const milestones = getPhaseMilestones(profile);
    const schedule = getPhaseSchedule(profile);
    expect(schedule.setup).toBeGreaterThan(0); // setup is never skipped.

    const { result } = renderHook(() => usePlayPhase(true, profile, undefined, 0));

    // Run well past the reveal milestone so the advance dispatch fires.
    act(() => {
      vi.advanceTimersByTime(milestones.reveal + 50);
    });

    expect(result.current.phase).toBe<PlayPhase>("advance");
  });
});

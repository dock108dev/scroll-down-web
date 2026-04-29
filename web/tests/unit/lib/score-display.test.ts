import { describe, it, expect } from "vitest";
import {
  differs,
  pickSnapshot,
  computeScoreDisplay,
} from "@/lib/score-display";
import type { GameCore } from "@/stores/game-data";

function makeCore(overrides: Partial<GameCore> = {}): GameCore {
  return {
    id: 1,
    leagueCode: "nba",
    gameDate: "2026-01-01T00:00:00Z",
    status: "in_progress",
    homeTeam: "Home",
    awayTeam: "Away",
    homeScore: 100,
    awayScore: 98,
    currentPeriod: 4,
    gameClock: "2:10",
    currentPeriodLabel: "Q4",
    ...overrides,
  };
}

describe("score-display helpers", () => {
  it("detects meaningful differences only", () => {
    const snap = {
      homeScore: 100,
      awayScore: 98,
      status: "in_progress",
      snapshotAt: new Date().toISOString(),
    };
    expect(differs(makeCore(), snap)).toBe(false);
    expect(differs(makeCore({ homeScore: 101 }), snap)).toBe(true);
    expect(differs(makeCore({ awayScore: 99 }), snap)).toBe(true);
    expect(differs(makeCore({ status: "final" }), snap)).toBe(true);
  });

  it("picks snapshot and suppresses duplicate clock label", () => {
    const a = pickSnapshot(makeCore({ gameClock: "Q4", currentPeriodLabel: "Q4" }));
    expect(a.clock).toBeUndefined();
    const b = pickSnapshot(makeCore({ gameClock: "2:10", currentPeriodLabel: "Q4" }));
    expect(b.clock).toBe("2:10");
    expect(b.period).toBe(4);
  });
});

describe("score-display computeScoreDisplay", () => {
  it("returns canonical live display for always mode", () => {
    const result = computeScoreDisplay(
      makeCore({ status: "in_progress" }),
      false,
      undefined,
      "always",
    );
    expect(result.visible).toBe(true);
    expect(result.frozen).toBe(false);
    expect(result.canToggle).toBe(false);
    expect(result.statusCategory).toBe("live");
  });

  it("hides pregame in always mode", () => {
    const result = computeScoreDisplay(
      makeCore({ status: "scheduled" }),
      false,
      undefined,
      "always",
    );
    expect(result.visible).toBe(false);
    expect(result.statusCategory).toBe("pregame");
  });

  it("shows live-updated indicator when unrevealed live game has scores", () => {
    const result = computeScoreDisplay(
      makeCore({ status: "in_progress" }),
      false,
      undefined,
      "onMarkRead",
    );
    expect(result.visible).toBe(false);
    expect(result.hasUpdate).toBe(true);
    expect(result.statusCategory).toBe("live-updated");
    expect(result.canToggle).toBe(true);
  });

  it("keeps unrevealed final game hidden but toggleable", () => {
    const result = computeScoreDisplay(
      makeCore({ status: "final" }),
      false,
      undefined,
      "onMarkRead",
    );
    expect(result.visible).toBe(false);
    expect(result.hasUpdate).toBe(false);
    expect(result.statusCategory).toBe("final");
    expect(result.canToggle).toBe(true);
  });

  it("shows revealed snapshot as frozen and marks updates when core changes", () => {
    const snapshot = {
      homeScore: 100,
      awayScore: 98,
      status: "in_progress",
      snapshotAt: new Date().toISOString(),
    };
    const updated = computeScoreDisplay(
      makeCore({ homeScore: 101 }),
      true,
      snapshot,
      "onMarkRead",
    );
    expect(updated.visible).toBe(true);
    expect(updated.frozen).toBe(true);
    expect(updated.hasUpdate).toBe(true);
    expect(updated.statusCategory).toBe("live-updated");
  });

  it("handles revealed with no snapshot by staying hidden", () => {
    const result = computeScoreDisplay(
      makeCore({ status: "final" }),
      true,
      undefined,
      "onMarkRead",
    );
    expect(result.visible).toBe(false);
    expect(result.homeScore).toBeNull();
    expect(result.statusCategory).toBe("final");
  });
});

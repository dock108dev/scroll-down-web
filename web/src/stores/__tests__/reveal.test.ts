import { describe, it, expect, beforeEach, vi } from "vitest";
import { useReveal, type RevealSnapshot } from "../reveal";
import { useSettings } from "../settings";

// Mock analytics to avoid side effects
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Mock game-data store for blacklist mode tests
const mockGetCore = vi.fn();
vi.mock("@/stores/game-data", () => ({
  useGameData: {
    getState: () => ({ getCore: mockGetCore }),
  },
}));

function makeSnapshot(overrides: Partial<RevealSnapshot> = {}): RevealSnapshot {
  return {
    homeScore: 3,
    awayScore: 1,
    status: "live",
    snapshotAt: new Date().toISOString(),
    isFrozen: false,
    ...overrides,
  };
}

function makeFinalSnapshot(overrides: Partial<RevealSnapshot> = {}): RevealSnapshot {
  return makeSnapshot({ status: "final", isFrozen: true, ...overrides });
}

describe("reveal store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useReveal.setState({
      revealedIds: new Set(),
      snapshots: new Map(),
      dailyRevealCount: 0,
      dailyRevealDate: new Date().toISOString().slice(0, 10),
    });
    // Reset settings to default
    useSettings.setState({ scoreRevealMode: "onMarkRead", followingLive: false });
    mockGetCore.mockReset();
  });

  describe("reveal()", () => {
    it("adds gameId to revealedIds and creates snapshot", () => {
      const snap = makeSnapshot();
      useReveal.getState().reveal(101, snap);

      expect(useReveal.getState().revealedIds.has(101)).toBe(true);
      expect(useReveal.getState().getSnapshot(101)).toEqual(snap);
    });

    it("increments dailyRevealCount on new reveals", () => {
      useReveal.getState().reveal(1, makeSnapshot());
      expect(useReveal.getState().dailyRevealCount).toBe(1);

      useReveal.getState().reveal(2, makeSnapshot());
      expect(useReveal.getState().dailyRevealCount).toBe(2);
    });

    it("does not increment dailyRevealCount on re-reveals", () => {
      useReveal.getState().reveal(1, makeSnapshot());
      expect(useReveal.getState().dailyRevealCount).toBe(1);

      useReveal.getState().reveal(1, makeSnapshot({ homeScore: 5 }));
      expect(useReveal.getState().dailyRevealCount).toBe(1);
    });

    it("resets dailyRevealCount when date changes", () => {
      useReveal.setState({ dailyRevealCount: 3, dailyRevealDate: "2025-01-01" });
      useReveal.getState().reveal(1, makeSnapshot());

      expect(useReveal.getState().dailyRevealCount).toBe(1);
      expect(useReveal.getState().dailyRevealDate).toBe(
        new Date().toISOString().slice(0, 10),
      );
    });
  });

  describe("acceptUpdate()", () => {
    it("updates snapshot when game is live", () => {
      const initial = makeSnapshot({ homeScore: 0, awayScore: 0 });
      useReveal.getState().reveal(1, initial);

      const update = makeSnapshot({ homeScore: 2, awayScore: 1 });
      useReveal.getState().acceptUpdate(1, update);

      const snap = useReveal.getState().getSnapshot(1);
      expect(snap?.homeScore).toBe(2);
      expect(snap?.awayScore).toBe(1);
      expect(snap?.isFrozen).toBe(false);
    });

    it("sets isFrozen when game transitions to final", () => {
      useReveal.getState().reveal(1, makeSnapshot());

      const finalUpdate = makeSnapshot({ status: "final", homeScore: 4 });
      useReveal.getState().acceptUpdate(1, finalUpdate);

      const snap = useReveal.getState().getSnapshot(1);
      expect(snap?.isFrozen).toBe(true);
      expect(snap?.homeScore).toBe(4);
    });

    it("is a no-op when isFrozen is true", () => {
      useReveal.getState().reveal(1, makeFinalSnapshot({ homeScore: 3 }));

      useReveal.getState().acceptUpdate(
        1,
        makeSnapshot({ homeScore: 99, status: "final" }),
      );

      const snap = useReveal.getState().getSnapshot(1);
      expect(snap?.homeScore).toBe(3);
    });

    it("handles cancelled games as terminal/frozen", () => {
      useReveal.getState().reveal(1, makeSnapshot());
      useReveal.getState().acceptUpdate(
        1,
        makeSnapshot({ status: "cancelled" }),
      );
      expect(useReveal.getState().getSnapshot(1)?.isFrozen).toBe(true);
    });
  });

  describe("hide()", () => {
    it("removes gameId from revealedIds", () => {
      useReveal.getState().reveal(1, makeSnapshot());
      useReveal.getState().hide(1);
      expect(useReveal.getState().revealedIds.has(1)).toBe(false);
    });

    it("keeps snapshot for quick re-reveal", () => {
      useReveal.getState().reveal(1, makeSnapshot());
      useReveal.getState().hide(1);
      expect(useReveal.getState().getSnapshot(1)).toBeDefined();
    });
  });

  describe("resetDailyCountIfStale()", () => {
    it("resets count when date is stale", () => {
      useReveal.setState({
        dailyRevealCount: 5,
        dailyRevealDate: "2020-01-01",
      });

      useReveal.getState().resetDailyCountIfStale();

      expect(useReveal.getState().dailyRevealCount).toBe(0);
      expect(useReveal.getState().dailyRevealDate).toBe(
        new Date().toISOString().slice(0, 10),
      );
    });

    it("does not reset when date is current", () => {
      const today = new Date().toISOString().slice(0, 10);
      useReveal.setState({ dailyRevealCount: 3, dailyRevealDate: today });

      useReveal.getState().resetDailyCountIfStale();

      expect(useReveal.getState().dailyRevealCount).toBe(3);
    });
  });

  describe("isRevealed() — mode awareness", () => {
    it("returns true for all games in 'always' mode", () => {
      useSettings.setState({ scoreRevealMode: "always" });
      expect(useReveal.getState().isRevealed(999)).toBe(true);
    });

    it("returns true for all games when followingLive is active", () => {
      useSettings.setState({ scoreRevealMode: "onMarkRead", followingLive: true });
      expect(useReveal.getState().isRevealed(999)).toBe(true);
    });

    it("checks revealedIds set in 'onMarkRead' mode", () => {
      useSettings.setState({ scoreRevealMode: "onMarkRead" });
      expect(useReveal.getState().isRevealed(1)).toBe(false);

      useReveal.getState().reveal(1, makeSnapshot());
      expect(useReveal.getState().isRevealed(1)).toBe(true);
    });

    it("blacklist mode: non-hidden games are always revealed", () => {
      useSettings.setState({
        scoreRevealMode: "blacklist",
        scoreHideLeagues: ["NBA"],
        scoreHideTeams: [],
      });
      mockGetCore.mockReturnValue({
        leagueCode: "MLB",
        homeTeam: "Red Sox",
        awayTeam: "Yankees",
      });

      expect(useReveal.getState().isRevealed(1)).toBe(true);
    });

    it("blacklist mode: hidden games require explicit reveal", () => {
      useSettings.setState({
        scoreRevealMode: "blacklist",
        scoreHideLeagues: ["NBA"],
        scoreHideTeams: [],
      });
      mockGetCore.mockReturnValue({
        leagueCode: "NBA",
        homeTeam: "Lakers",
        awayTeam: "Celtics",
      });

      expect(useReveal.getState().isRevealed(1)).toBe(false);

      useReveal.getState().reveal(1, makeSnapshot());
      expect(useReveal.getState().isRevealed(1)).toBe(true);
    });

    it("blacklist mode: falls back to set check when no core data", () => {
      useSettings.setState({
        scoreRevealMode: "blacklist",
        scoreHideLeagues: ["NBA"],
        scoreHideTeams: [],
      });
      mockGetCore.mockReturnValue(undefined);

      expect(useReveal.getState().isRevealed(1)).toBe(false);

      useReveal.getState().reveal(1, makeSnapshot());
      expect(useReveal.getState().isRevealed(1)).toBe(true);
    });
  });

  describe("batch operations", () => {
    it("revealBatch adds multiple games", () => {
      useReveal.getState().revealBatch([
        { gameId: 1, snapshot: makeSnapshot() },
        { gameId: 2, snapshot: makeSnapshot() },
        { gameId: 3, snapshot: makeSnapshot() },
      ]);

      expect(useReveal.getState().revealedIds.size).toBe(3);
      expect(useReveal.getState().snapshots.size).toBe(3);
    });

    it("hideBatch removes multiple games", () => {
      useReveal.getState().revealBatch([
        { gameId: 1, snapshot: makeSnapshot() },
        { gameId: 2, snapshot: makeSnapshot() },
        { gameId: 3, snapshot: makeSnapshot() },
      ]);
      useReveal.getState().hideBatch([1, 3]);

      expect(useReveal.getState().revealedIds.has(1)).toBe(false);
      expect(useReveal.getState().revealedIds.has(2)).toBe(true);
      expect(useReveal.getState().revealedIds.has(3)).toBe(false);
    });
  });

  describe("MAX_SNAPSHOTS eviction", () => {
    it("evicts oldest snapshots when count exceeds limit", () => {
      const entries: { gameId: number; snapshot: RevealSnapshot }[] = [];
      for (let i = 0; i < 55; i++) {
        entries.push({
          gameId: i,
          snapshot: makeSnapshot({
            snapshotAt: new Date(Date.now() - (55 - i) * 60_000).toISOString(),
          }),
        });
      }
      useReveal.getState().revealBatch(entries);

      // In-memory store has all 55
      expect(useReveal.getState().snapshots.size).toBe(55);

      // Simulate persist write + read cycle
      const storage = (useReveal.persist as unknown as { getOptions: () => { storage: { setItem: (n: string, v: unknown) => void; getItem: (n: string) => unknown } } }).getOptions().storage;

      // Trigger setItem (simulating what persist does)
      const stateForPersist = {
        state: {
          revealedIds: useReveal.getState().revealedIds,
          snapshots: useReveal.getState().snapshots,
          dailyRevealCount: useReveal.getState().dailyRevealCount,
          dailyRevealDate: useReveal.getState().dailyRevealDate,
        },
        version: 2,
      };
      storage.setItem("sd-read-state", stateForPersist);

      const rehydrated = storage.getItem("sd-read-state") as {
        state: { snapshots: Map<number, RevealSnapshot> };
      };
      expect(rehydrated.state.snapshots.size).toBeLessThanOrEqual(50);
    });
  });
});

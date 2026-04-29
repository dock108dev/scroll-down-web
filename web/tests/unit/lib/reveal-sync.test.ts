import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const revealBatch = vi.fn();
const getSnapshot = vi.fn();

let revealSubscribeCb: (() => void) | undefined;

vi.mock("@/stores/reveal", () => ({
  useReveal: {
    getState: vi.fn(() => ({
      revealedIds: new Set<number>([10]),
      snapshots: new Map<number, import("@/stores/reveal").RevealSnapshot>(),
      revealBatch,
      getSnapshot,
    })),
    subscribe: vi.fn((cb: () => void) => {
      revealSubscribeCb = cb;
      return vi.fn();
    }),
  },
}));

vi.mock("@/stores/tier", () => ({
  useTier: {
    getState: vi.fn(() => ({
      isAllowed: (gate: string) => gate === "cross_device_sync",
    })),
  },
}));

describe("reveal-sync", () => {
  beforeEach(() => {
    revealSubscribeCb = undefined;
    revealBatch.mockClear();
    getSnapshot.mockReturnValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          revealedIds: [11, 12],
          snapshots: {
            "11": {
              homeScore: 100,
              awayScore: 99,
              status: "final",
              snapshotAt: "2026-06-10T00:00:00.000Z",
            },
            "12": {
              homeScore: 1,
              awayScore: 0,
              status: "final",
              snapshotAt: "2026-01-01T00:00:00.000Z",
            },
          },
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
      }),
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pulls remote state on start and merges via revealBatch", async () => {
    getSnapshot.mockImplementation((id: number) => {
      if (id === 11) {
        return {
          homeScore: 0,
          awayScore: 0,
          status: "live",
          snapshotAt: "2026-01-01T00:00:00.000Z",
        };
      }
      if (id === 12) {
        return {
          homeScore: 0,
          awayScore: 0,
          status: "live",
          snapshotAt: "2026-06-02T00:00:00.000Z",
        };
      }
      return undefined;
    });
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(revealBatch).toHaveBeenCalled());
    const batchArg = revealBatch.mock.calls[0][0];
    const id11 = batchArg.find((x: { gameId: number }) => x.gameId === 11);
    const id12 = batchArg.find((x: { gameId: number }) => x.gameId === 12);
    expect(id11?.snapshot.snapshotAt).toContain("2026-06-10");
    expect(id12?.snapshot.snapshotAt).toContain("2026-06-02");
    stopRevealSync();
  });

  it("fills placeholder snapshot when remote and local snapshots are missing", async () => {
    getSnapshot.mockReturnValue(undefined);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        revealedIds: [99],
        snapshots: {},
        updatedAt: "",
      }),
    });
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(revealBatch).toHaveBeenCalled());
    const snap = revealBatch.mock.calls[0][0][0].snapshot;
    expect(snap.status).toBe("unknown");
    expect(snap.snapshotAt).toMatch(/^\d{4}-/);
    stopRevealSync();
  });

  it("skips merge when remote ids are already local", async () => {
    revealBatch.mockClear();
    const fetchLocalOnly = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        revealedIds: [10],
        snapshots: {},
        updatedAt: "",
      }),
    });
    vi.stubGlobal("fetch", fetchLocalOnly);
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(revealBatch).not.toHaveBeenCalled();
    stopRevealSync();
  });

  it("returns early when fetch is not ok", async () => {
    revealBatch.mockClear();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 });
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(revealBatch).not.toHaveBeenCalled();
    stopRevealSync();
  });

  it("warns when fetch rejects on pull", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("[reveal-sync]"))).toBe(true);
    warn.mockRestore();
    stopRevealSync();
  });

  it("warns when merge throws inside pullAndMerge", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    revealBatch.mockImplementationOnce(() => {
      throw new Error("merge boom");
    });
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(warn.mock.calls.some((c) => String(c[1]).includes("merge boom"))).toBe(true);
    warn.mockRestore();
    stopRevealSync();
  });

  it("schedules debounced PUT when the reveal subscription fires", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          revealedIds: [],
          snapshots: {},
          updatedAt: "",
        }),
      })
      .mockResolvedValue({ ok: true });
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(revealSubscribeCb).toBeDefined();
    revealSubscribeCb?.();
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(fetch).mock.calls.some((c) => c[1]?.method === "PUT")).toBe(true);
    stopRevealSync();
  });

  it("flushRevealSync PUTs local snapshots", async () => {
    const { flushRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        revealedIds: [],
        snapshots: {},
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
    });
    const { startRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await flushRevealSync();
    expect(vi.mocked(fetch).mock.calls.some((c) => c[1]?.method === "PUT")).toBe(true);
    stopRevealSync();
  });

  it("no-ops when tier gate denies sync", async () => {
    const tier = await import("@/stores/tier");
    vi.mocked(tier.useTier.getState).mockReturnValueOnce({
      isAllowed: () => false,
    });
    revealBatch.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ revealedIds: [], snapshots: {}, updatedAt: "" }),
      }),
    );
    const { startRevealSync, stopRevealSync } = await import("@/lib/reveal-sync");
    startRevealSync();
    await vi.runOnlyPendingTimersAsync();
    expect(revealBatch).not.toHaveBeenCalled();
    stopRevealSync();
  });
});

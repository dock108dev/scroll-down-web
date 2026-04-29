import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POLLING } from "@/lib/config";

const startRevealSync = vi.fn();
const stopRevealSync = vi.fn();

vi.mock("@/lib/reveal-sync", () => ({
  startRevealSync,
  stopRevealSync,
}));

const isDegradedFn = vi.fn(() => false);
vi.mock("@/hooks/useHealthStatus", () => ({
  isDegraded: () => isDegradedFn(),
}));

const authState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("@/stores/auth", () => ({
  useAuth: {
    getState: () => authState,
  },
}));

const settingsStore = vi.hoisted(() => ({
  theme: "dark" as const,
  scoreRevealMode: "onMarkRead" as const,
  scoreHideLeagues: [] as string[],
  scoreHideTeams: [] as string[],
  preferredSportsbook: "dk",
  oddsFormat: "american" as const,
  autoResumePosition: false,
  homeExpandedSections: [] as string[],
  hideLimitedData: false,
  timelineDefaultTiers: [] as number[],
  followingLive: false,
  followingLiveAt: 0,
  setTheme: vi.fn(),
  setScoreRevealMode: vi.fn(),
  setScoreHideLeagues: vi.fn(),
  setScoreHideTeams: vi.fn(),
  setPreferredSportsbook: vi.fn(),
  setOddsFormat: vi.fn(),
  setAutoResumePosition: vi.fn(),
  setHomeExpandedSections: vi.fn(),
  setHideLimitedData: vi.fn(),
  setTimelineDefaultTiers: vi.fn(),
  setFollowingLive: vi.fn(),
}));

vi.mock("@/stores/settings", () => ({
  useSettings: {
    getState: () => settingsStore,
    subscribe: vi.fn(() => vi.fn()),
  },
}));

const pinnedIds = vi.hoisted(() => new Set<number>([100]));
const togglePin = vi.fn();

vi.mock("@/stores/pinned-games", () => ({
  usePinnedGames: {
    getState: () => ({
      get pinnedIds() {
        return pinnedIds;
      },
      togglePin,
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

const revealedIds = vi.hoisted(() => new Set<number>([5]));
const hideBatch = vi.fn();
const revealBatch = vi.fn();

vi.mock("@/stores/reveal", () => ({
  useReveal: {
    getState: () => ({
      get revealedIds() {
        return revealedIds;
      },
      hideBatch,
      revealBatch,
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

describe("preferences-sync", () => {
  beforeEach(() => {
    authState.token = "tok";
    isDegradedFn.mockReturnValue(false);
    pinnedIds.clear();
    pinnedIds.add(100);
    revealedIds.clear();
    revealedIds.add(5);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          settings: {
            theme: "light",
            scoreRevealMode: "always",
            scoreHideLeagues: ["NBA"],
            scoreHideTeams: [],
            preferredSportsbook: "fd",
            oddsFormat: "decimal",
            autoResumePosition: true,
            homeExpandedSections: ["scores"],
            hideLimitedData: true,
            timelineDefaultTiers: [2],
            followingLive: true,
            followingLiveAt: Date.now(),
          },
          pinnedGameIds: [100, 200],
          revealedGameIds: [10],
        }),
      }),
    );
    startRevealSync.mockClear();
    stopRevealSync.mockClear();
    togglePin.mockClear();
    hideBatch.mockClear();
    revealBatch.mockClear();
    settingsStore.setTheme.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pulls preferences, hydrates stores, and wires reveal sync", async () => {
    const mod = await import("@/lib/preferences-sync");
    await mod.pullAndStartSync();
    expect(settingsStore.setTheme).toHaveBeenCalledWith("light");
    expect(startRevealSync).toHaveBeenCalled();
    expect(togglePin).toHaveBeenCalled();
    expect(hideBatch).toHaveBeenCalled();
    expect(revealBatch).toHaveBeenCalled();
  });

  it("stopPreferenceSync stops reveal sync", async () => {
    const mod = await import("@/lib/preferences-sync");
    mod.stopPreferenceSync();
    expect(stopRevealSync).toHaveBeenCalled();
  });

  it("flushPreferences PUTs with keepalive when authed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("@/lib/preferences-sync");
    mod.flushPreferences();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me/preferences",
      expect.objectContaining({ method: "PUT", keepalive: true }),
    );
  });

  it("flushPreferences skips fetch without token", async () => {
    authState.token = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("@/lib/preferences-sync");
    mod.flushPreferences();
    expect(fetchMock).not.toHaveBeenCalled();
    authState.token = "tok";
  });

  it("does not fetch preferences when health is degraded", async () => {
    isDegradedFn.mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("@/lib/preferences-sync");
    await mod.pullAndStartSync();
    expect(fetchMock).not.toHaveBeenCalled();
    isDegradedFn.mockReturnValue(false);
  });

  it("warns when preference fetch fails at network layer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    vi.resetModules();
    authState.token = "tok";
    const mod = await import("@/lib/preferences-sync");
    await mod.pullAndStartSync();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("[prefs-sync]"))).toBe(true);
    warn.mockRestore();
  });

  it("warns when preference GET returns non-OK once per sync cycle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Busy" }),
    );
    vi.resetModules();
    authState.token = "tok";
    const mod = await import("@/lib/preferences-sync");
    await mod.pullAndStartSync();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("fetchPreferences failed"))).toBe(
      true,
    );
    warn.mockRestore();
  });

  it("stale followingLive triggers correction push cleared when flushPreferences runs first", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            settings: {
              theme: "light",
              scoreRevealMode: "always",
              scoreHideLeagues: [],
              scoreHideTeams: [],
              preferredSportsbook: "dk",
              oddsFormat: "american",
              autoResumePosition: false,
              homeExpandedSections: [],
              hideLimitedData: false,
              timelineDefaultTiers: [],
              followingLive: true,
              followingLiveAt: Date.now() - POLLING.FOLLOWING_LIVE_TTL_MS - 60_000,
            },
            pinnedGameIds: [],
            revealedGameIds: [],
          }),
        })
        .mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      vi.resetModules();
      authState.token = "tok";
      const mod = await import("@/lib/preferences-sync");
      await mod.pullAndStartSync();
      mod.flushPreferences();
      const putCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT");
      expect(putCalls.some((c) => c[1]?.keepalive === true)).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(putCalls.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

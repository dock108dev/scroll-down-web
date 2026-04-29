import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const logout = vi.fn();
const getState = vi.fn(() => ({
  token: null as string | null,
  logout,
}));

vi.mock("@/stores/auth", () => ({
  useAuth: { getState },
}));

describe("fetchApi", () => {
  beforeEach(() => {
    getState.mockReturnValue({ token: null, logout });
    logout.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads JSON on success", async () => {
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/api/games")).resolves.toEqual({ ok: true });
  });

  it("sends bearer token when authenticated", async () => {
    getState.mockReturnValue({ token: "tok", logout });
    const { fetchApi } = await import("@/lib/api");
    await fetchApi("/x");
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer tok",
    });
  });

  it("logs out on 401 with token", async () => {
    getState.mockReturnValue({ token: "tok", logout });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }),
    );
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/x")).rejects.toThrow();
    expect(logout).toHaveBeenCalled();
  });

  it("maps error classes for failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/x")).rejects.toThrow(/Something went wrong/);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      }),
    );
    await expect(fetchApi("/y")).rejects.toThrow(/having trouble loading/);
  });

  it("api.games builds query string", async () => {
    const { api } = await import("@/lib/api");
    const params = new URLSearchParams({ d: "1" });
    await api.games(params);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/api/games?d=1");
  });

  it("covers convenience endpoint wrappers", async () => {
    const { api } = await import("@/lib/api");
    await api.historyGames(new URLSearchParams({ end: "1" }));
    await api.game(42);
    await api.flow(43);
    await api.fairbetOdds(new URLSearchParams({ league: "nba" }));
    await api.fairbetLiveGames("nba");
    await api.fairbetLiveGames();
    await api.fairbetLive(9, "moneyline", "best_ev");
    await api.golfTournaments(new URLSearchParams({ tour: "pga" }));
    await api.golfTournaments();
    await api.golfTournament("evt1");
    await api.golfLeaderboard("evt1");
    const urls = vi.mocked(fetch).mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("/api/history"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/games/42"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/fairbet/live/games"))).toBe(true);
    expect(urls.some((u) => u.includes("fairbet/live?"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/golf/tournaments/evt1"))).toBe(true);
  });

  it("maps AbortError to timeout message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new DOMException("Aborted", "AbortError"))),
    );
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/timeout")).rejects.toThrow(/timed out/i);
  });

  it("maps generic fetch failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/bad")).rejects.toThrow(/Unable to load data/);
  });

  it("merges Headers instances from init", async () => {
    const { fetchApi } = await import("@/lib/api");
    const headers = new Headers({ "X-Custom": "42" });
    await fetchApi("/with-headers", { headers });
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      "x-custom": "42",
    });
  });

  it("registers cleanup when init carries an active AbortSignal", async () => {
    const ac = new AbortController();
    const { fetchApi } = await import("@/lib/api");
    await fetchApi("/with-live-signal", { signal: ac.signal });
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("still requests when user signal is already aborted (combined abort)", async () => {
    const ac = new AbortController();
    ac.abort();
    const { fetchApi } = await import("@/lib/api");
    await fetchApi("/aborted-input", { signal: ac.signal });
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("throws generic client error for non-auth 4xx failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    );
    const { fetchApi } = await import("@/lib/api");
    await expect(fetchApi("/missing")).rejects.toThrow(/Unable to load data/);
  });
});

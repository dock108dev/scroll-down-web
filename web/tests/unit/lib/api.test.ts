import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchApi, api } from "@/lib/api";

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function notOk(status: number) {
  return { ok: false, status, json: async () => ({}) } as Response;
}

describe("fetchApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns parsed JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ a: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const data = await fetchApi<{ a: number }>("/x");
    expect(data.a).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/x",
      expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) }),
    );
  });

  it("forwards headers from a Headers instance and from a record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal("fetch", fetchMock);
    await fetchApi("/h1", { headers: new Headers({ "x-test": "1" }) });
    await fetchApi("/h2", { headers: { "x-other": "2" } });
    const h1 = fetchMock.mock.calls[0][1].headers;
    const h2 = fetchMock.mock.calls[1][1].headers;
    expect(h1["x-test"]).toBe("1");
    expect(h2["x-other"]).toBe("2");
  });

  it("maps each error status to its user-facing message", async () => {
    const cases: Array<[number, RegExp]> = [
      [404, /Not found/],
      [429, /busy/i],
      [503, /temporarily delayed/i],
      [500, /something went wrong/i],
      [400, /Unable to load data/i],
    ];
    for (const [status, expected] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(notOk(status)));
      await expect(fetchApi("/x")).rejects.toThrow(expected);
    }
  });

  it("converts AbortError into a timeout message", async () => {
    const abortErr = new DOMException("aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));
    await expect(fetchApi("/x")).rejects.toThrow(/timed out/i);
  });

  it("converts non-abort network errors into a generic load message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(fetchApi("/x")).rejects.toThrow(/Unable to load data/i);
  });

  it("aborts when an already-aborted user signal is provided", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      expect((init.signal as AbortSignal).aborted).toBe(true);
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(fetchApi("/x", { signal: ctrl.signal })).rejects.toThrow(/timed out/i);
  });

  it("aborts when the user signal fires mid-flight", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        capturedSignal!.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    const p = fetchApi("/x", { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toThrow(/timed out/i);
  });
});

describe("api convenience methods", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([])));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recentGames hits /api/games/recent", async () => {
    await api.recentGames();
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe(
      "/api/games/recent",
    );
  });

  it("cards omits since when undefined and appends it when given", async () => {
    await api.cards(7);
    await api.cards(7, { since: 42 });
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0][0]).toBe("/api/games/7/cards");
    expect(calls[1][0]).toBe("/api/games/7/cards?since=42");
  });

  it("summary hits /api/games/<id>/summary", async () => {
    await api.summary(11);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe(
      "/api/games/11/summary",
    );
  });
});

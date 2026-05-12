import { describe, it, expect, afterEach, vi } from "vitest";
import {
  ScrollDownMlbApiError,
  getScrollDownMlbDeck,
  getScrollDownMlbReveal,
  getScrollDownMlbRecentGames,
} from "@/lib/scroll-down-mlb-api";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, body = "boom"): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScrollDownMlbApiError", () => {
  it("carries status + name and is a real Error", () => {
    const err = new ScrollDownMlbApiError(503, "down");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.name).toBe("ScrollDownMlbApiError");
    expect(err.message).toBe("down");
  });
});

describe("getScrollDownMlbDeck", () => {
  it("returns parsed JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cards: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const data = await getScrollDownMlbDeck("game-1");
    expect(data).toEqual({ cards: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/games/game-1/cards",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("URL-encodes the game id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cards: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await getScrollDownMlbDeck("a/b c");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/games/a%2Fb%20c/cards");
  });

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(404)));
    expect(await getScrollDownMlbDeck("g")).toBeNull();
  });

  it("rethrows ScrollDownMlbApiError on 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(500, "oops")));
    await expect(getScrollDownMlbDeck("g")).rejects.toMatchObject({
      name: "ScrollDownMlbApiError",
      status: 500,
      message: "oops",
    });
  });

  it("uses a generic message when the error body is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(502, "")));
    await expect(getScrollDownMlbDeck("g")).rejects.toMatchObject({
      status: 502,
      message: "Request failed with status 502",
    });
  });

  it("converts AbortError into a status-0 timeout error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(getScrollDownMlbDeck("g")).rejects.toMatchObject({
      status: 0,
      message: /timed out/i,
    });
  });

  it("converts other network errors into a status-0 reach error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(getScrollDownMlbDeck("g")).rejects.toMatchObject({
      status: 0,
      message: /Unable to reach/i,
    });
  });

  it("aborts fetch when the user's signal is already aborted", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      expect((init.signal as AbortSignal).aborted).toBe(true);
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      getScrollDownMlbDeck("g", { signal: ctrl.signal }),
    ).rejects.toMatchObject({ status: 0 });
  });

  it("propagates a mid-flight user abort to the underlying fetch", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      const sig = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        sig.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    const p = getScrollDownMlbDeck("g", { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ status: 0 });
  });
});

describe("getScrollDownMlbReveal", () => {
  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "final" })),
    );
    expect(await getScrollDownMlbReveal("g")).toEqual({ status: "final" });
  });

  it("returns null on 409 (reveal not ready)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(409)));
    expect(await getScrollDownMlbReveal("g")).toBeNull();
  });

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(404)));
    expect(await getScrollDownMlbReveal("g")).toBeNull();
  });

  it("rethrows on 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(500)));
    await expect(getScrollDownMlbReveal("g")).rejects.toMatchObject({ status: 500 });
  });
});

describe("getScrollDownMlbRecentGames", () => {
  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ games: [] })),
    );
    expect(await getScrollDownMlbRecentGames()).toEqual({ games: [] });
  });

  it("rethrows on 5xx (no fallback)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(503)));
    await expect(getScrollDownMlbRecentGames()).rejects.toMatchObject({
      status: 503,
    });
  });
});

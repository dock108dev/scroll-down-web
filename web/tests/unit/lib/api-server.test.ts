import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sportsApiBaseUrl,
  sportsApiKey,
  ApiError,
  apiFetch,
  cachedApiFetch,
  clearApiResponseCache,
} from "@/lib/api-server";
import { BACKEND_BASE_URL } from "@/lib/config";

describe("api-server URL and key helpers", () => {
  beforeEach(() => {
    vi.stubEnv("SPORTS_API_INTERNAL_URL", "");
    vi.stubEnv("SPORTS_DATA_API_KEY", "");
    vi.stubEnv("SPORTS_API_KEY", "");
    vi.stubEnv("API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses internal URL override when set", () => {
    vi.stubEnv("SPORTS_API_INTERNAL_URL", "https://upstream.example/");
    expect(sportsApiBaseUrl()).toBe("https://upstream.example/");
  });

  it("falls back to BACKEND_BASE_URL", () => {
    expect(sportsApiBaseUrl()).toBe(BACKEND_BASE_URL);
  });

  it("reads API key from env precedence chain", () => {
    vi.stubEnv("SPORTS_DATA_API_KEY", "data-key");
    expect(sportsApiKey()).toBe("data-key");
    vi.stubEnv("SPORTS_DATA_API_KEY", "");
    vi.stubEnv("SPORTS_API_KEY", "fallback-key");
    expect(sportsApiKey()).toBe("fallback-key");
  });
});

describe("ApiError", () => {
  it("maps gateway-like statuses to proxy 502", () => {
    expect(new ApiError(401, "x").proxyStatus).toBe(502);
    expect(new ApiError(403, "x").proxyStatus).toBe(502);
    expect(new ApiError(502, "x").proxyStatus).toBe(502);
    expect(new ApiError(503, "x").proxyStatus).toBe(502);
    expect(new ApiError(504, "x").proxyStatus).toBe(502);
    expect(new ApiError(418, "x").proxyStatus).toBe(418);
  });

  it("stringifies with status", () => {
    expect(String(new ApiError(500, "oops"))).toContain("500");
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("SPORTS_DATA_API_KEY", "key");
    vi.stubEnv("SPORTS_API_INTERNAL_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearApiResponseCache();
  });

  it("parses JSON and applies deep string fixes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: "world" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await apiFetch<{ hello: string }>("/games");
    expect(data.hello).toBe("world");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/games"),
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it("throws ApiError on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "err",
      }),
    );
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("forwards revalidate to Next fetch when set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/y", { revalidate: 120 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ next: { revalidate: 120 } }),
    );
  });

  it("repairs double-encoded UTF-8 in JSON strings (mojibake)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: "DÃ¶rries" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await apiFetch<{ label: string }>("/x");
    expect(data.label).toBe("Dörries");
  });

  it("walks nested objects and passes through null leaves in deepFixStrings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nested: { empty: null as null } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await apiFetch<{ nested: { empty: null } }>("/x");
    expect(data.nested.empty).toBeNull();
  });

  it("leaves unrecoverable mojibake bytes unchanged on decode failure", async () => {
    const bad = String.fromCharCode(0xff, 0xff, 0xff);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: bad }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await apiFetch<{ label: string }>("/x");
    expect(data.label).toBe(bad);
  });
});

describe("cachedApiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("SPORTS_DATA_API_KEY", "key");
    vi.stubEnv("SPORTS_API_INTERNAL_URL", "");
    clearApiResponseCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearApiResponseCache();
  });

  it("serves fresh cached data without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 10_000,
      staleMs: 60_000,
    });
    const second = await cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 10_000,
      staleMs: 60_000,
    });

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("fresh");
    expect(second.data.value).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent requests for the same key", async () => {
    let resolveJson: ((value: { value: number }) => void) | undefined;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => new Promise((resolve) => { resolveJson = resolve; }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const one = cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 10_000,
      staleMs: 60_000,
    });
    const two = cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 10_000,
      staleMs: 60_000,
    });
    await vi.waitFor(() => {
      expect(resolveJson).toBeDefined();
    });
    resolveJson?.({ value: 2 });

    const results = await Promise.all([one, two]);
    expect(results.map((r) => r.data.value)).toEqual([2, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves stale cached data on 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: 1 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "busy",
      });
    vi.stubGlobal("fetch", fetchMock);

    await cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 0,
      staleMs: 60_000,
    });
    const second = await cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 0,
      staleMs: 60_000,
    });

    expect(second.cacheStatus).toBe("stale");
    expect(second.data.value).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not serve stale cached data on 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: 1 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "missing",
      });
    vi.stubGlobal("fetch", fetchMock);

    await cachedApiFetch<{ value: number }>("k", "/x", {
      freshMs: 0,
      staleMs: 60_000,
    });

    await expect(
      cachedApiFetch<{ value: number }>("k", "/x", {
        freshMs: 0,
        staleMs: 60_000,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

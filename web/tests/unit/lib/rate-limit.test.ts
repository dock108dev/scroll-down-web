import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SCROLLDOWN_E2E", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("allows requests under the cap", () => {
    const limiter = createRateLimiter({ window: 60_000, max: 3 });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").ok).toBe(true);
  });

  it("blocks after max requests until window advances", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const limiter = createRateLimiter({ window: 1000, max: 2 });
    expect(limiter.check("ip").ok).toBe(true);
    expect(limiter.check("ip").ok).toBe(true);
    const blocked = limiter.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    vi.advanceTimersByTime(1001);
    expect(limiter.check("ip").ok).toBe(true);
  });

  it("bypasses when E2E flag is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SCROLLDOWN_E2E", "1");
    const limiter = createRateLimiter({ window: 1000, max: 1 });
    expect(limiter.check("x").ok).toBe(true);
    expect(limiter.check("x").ok).toBe(true);
  });
});

/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-instance deployments (standalone Next.js on Hetzner).
 * For multi-instance, swap the backing store for Redis.
 *
 * Usage:
 *   const limiter = createRateLimiter({ window: 60_000, max: 5 });
 *   const result = limiter.check(clientIp);
 *   if (!result.ok) return NextResponse.json(..., { status: 429 });
 */

interface RateLimiterOptions {
  /** Time window in milliseconds */
  window: number;
  /** Max requests per window */
  max: number;
}

interface CheckResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

interface Entry {
  timestamps: number[];
}

export function createRateLimiter({ window, max }: RateLimiterOptions) {
  const store = new Map<string, Entry>();

  // Prune stale entries every 60s to prevent unbounded memory growth
  const PRUNE_INTERVAL = 60_000;
  let lastPrune = Date.now();

  function prune(now: number) {
    if (now - lastPrune < PRUNE_INTERVAL) return;
    lastPrune = now;
    for (const [key, entry] of store) {
      // Remove entries where all timestamps are outside the window
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - window) {
        store.delete(key);
      }
    }
  }

  function check(key: string): CheckResult {
    // E2E: parallel Playwright workers all share 127.0.0.1 and would trip
    // per-IP buckets within seconds. Bypass keeps the live route logic intact.
    if (process.env.NEXT_PUBLIC_SCROLLDOWN_E2E === "1") {
      return { ok: true, remaining: max, resetMs: window };
    }

    const now = Date.now();
    prune(now);

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Drop timestamps outside the current window
    const cutoff = now - window;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= max) {
      const oldest = entry.timestamps[0];
      return {
        ok: false,
        remaining: 0,
        resetMs: oldest + window - now,
      };
    }

    entry.timestamps.push(now);
    return {
      ok: true,
      remaining: max - entry.timestamps.length,
      resetMs: window,
    };
  }

  return { check };
}

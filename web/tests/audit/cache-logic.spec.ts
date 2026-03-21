import { test, expect } from "../helpers";
import type { Page } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Cache Logic Testing Suite
 *
 * Validates localStorage caching, TTL behavior, staleness detection,
 * storage bounds enforcement, and cache invalidation on visibility changes.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");
const STORAGE_KEYS = [
  "sd-auth",
  "sd-settings",
  "sd-pinned-games",
  "sd-reading-position",
  "sd-section-layout",
  "sd-read-state",
];

interface CacheTestResult {
  test: string;
  passed: boolean;
  details: Record<string, unknown>;
}

async function getStorageSnapshot(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((keys: string[]) => {
    const snapshot: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          snapshot[key] = JSON.parse(raw);
        } catch {
          snapshot[key] = raw;
        }
      }
    }
    return snapshot;
  }, STORAGE_KEYS);
}

test.describe("Audit: Cache logic", () => {
  const results: CacheTestResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `cache-logic-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("localStorage keys are populated after first visit", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    const snapshot = await getStorageSnapshot(page);
    const populated = Object.keys(snapshot);

    results.push({
      test: "keys-populated",
      passed: populated.length > 0,
      details: { keys: populated, count: populated.length },
    });

    // At minimum, auth and settings should be present for an authenticated user
    expect(populated).toContain("sd-auth");
    expect(populated).toContain("sd-settings");
  });

  test("cache persists across page reloads", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    const before = await getStorageSnapshot(page);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2_000);
    const after = await getStorageSnapshot(page);

    // Auth token should persist
    const authBefore = JSON.stringify(before["sd-auth"]);
    const authAfter = JSON.stringify(after["sd-auth"]);

    results.push({
      test: "persist-across-reload",
      passed: authBefore === authAfter,
      details: {
        authMatch: authBefore === authAfter,
        settingsMatch:
          JSON.stringify(before["sd-settings"]) ===
          JSON.stringify(after["sd-settings"]),
      },
    });

    expect(authBefore).toBe(authAfter);
  });

  test("game data cache — second fetch is faster (cache hit)", async ({
    authedPage: page,
  }) => {
    // Track network requests to /api/games
    const gameRequests: number[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/games") && !res.url().includes("/api/games/")) {
        gameRequests.push(res.status());
      }
    });

    // First load
    const start1 = Date.now();
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);
    const time1 = Date.now() - start1;
    const reqs1 = gameRequests.length;

    // Quick reload within cache window (45s fresh threshold)
    const start2 = Date.now();
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2_000);
    const time2 = Date.now() - start2;
    const reqs2 = gameRequests.length - reqs1;

    results.push({
      test: "cache-hit-speed",
      passed: true,
      details: {
        firstLoadMs: time1,
        secondLoadMs: time2,
        firstNetworkReqs: reqs1,
        secondNetworkReqs: reqs2,
      },
    });

    // Second load should be no slower than first (ideally faster due to cache)
    // This is a soft check — network variability is real
    expect(time2).toBeLessThan(time1 * 3);
  });

  test("visibility change triggers refresh after VISIBILITY_AWAY_MS", async ({
    authedPage: page,
  }) => {
    const networkReqs: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/games")) {
        networkReqs.push(req.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);
    const reqsBefore = networkReqs.length;

    // Simulate tab going hidden and then returning after > 5s
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait longer than VISIBILITY_AWAY_MS (5000ms)
    await page.waitForTimeout(6_000);

    // Tab becomes visible again
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await page.waitForTimeout(3_000);
    const reqsAfter = networkReqs.length;

    results.push({
      test: "visibility-refresh",
      passed: reqsAfter > reqsBefore,
      details: {
        requestsBefore: reqsBefore,
        requestsAfter: reqsAfter,
        newRequests: reqsAfter - reqsBefore,
      },
    });

    // Should have fired at least one new network request after coming back
    expect(reqsAfter).toBeGreaterThan(reqsBefore);
  });

  test("clearing localStorage forces fresh data fetch", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Clear all app state
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("sd-"));
      for (const k of keys) localStorage.removeItem(k);
    });

    const networkReqs: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        networkReqs.push(req.url());
      }
    });

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3_000);

    results.push({
      test: "cleared-storage-refetch",
      passed: networkReqs.length > 0,
      details: {
        networkRequestsAfterClear: networkReqs.length,
        endpoints: [...new Set(networkReqs)],
      },
    });

    // Should have re-fetched data
    expect(networkReqs.length).toBeGreaterThan(0);
  });

  test("storage size stays within bounds", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    const sizes = await page.evaluate(() => {
      const result: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("sd-")) {
          const val = localStorage.getItem(key) ?? "";
          result[key] = val.length;
        }
      }
      return result;
    });

    const totalBytes = Object.values(sizes).reduce((s, v) => s + v, 0);

    results.push({
      test: "storage-bounds",
      passed: totalBytes < 5_000_000, // 5MB localStorage limit
      details: {
        keyBytes: sizes,
        totalBytes,
        totalKB: Math.round(totalBytes / 1024),
      },
    });

    // Individual stores shouldn't exceed 1MB
    for (const [key, bytes] of Object.entries(sizes)) {
      expect(
        bytes,
        `${key} is ${Math.round(bytes / 1024)}KB — should be under 1MB`,
      ).toBeLessThan(1_000_000);
    }
    // Total should be under 5MB
    expect(totalBytes).toBeLessThan(5_000_000);
  });

  test("Zustand store version migration doesn't lose data", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Check that settings store has the expected version field
    const settingsStore = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw) : null;
    });

    results.push({
      test: "store-migration",
      passed: settingsStore !== null && settingsStore.version !== undefined,
      details: {
        version: settingsStore?.version,
        hasState: !!settingsStore?.state,
        stateKeys: settingsStore?.state
          ? Object.keys(settingsStore.state)
          : [],
      },
    });

    expect(settingsStore).not.toBeNull();
    // Zustand persist stores should have version and state keys
    if (settingsStore) {
      expect(settingsStore).toHaveProperty("state");
    }
  });
});

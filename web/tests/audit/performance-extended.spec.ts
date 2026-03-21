import { test, expect } from "@playwright/test";
import { waitForLoad, collectPerformanceMetrics, AUTH_STATE_PATH } from "../helpers";
import fs from "fs";
import path from "path";

/**
 * Extended Performance Metrics Suite
 *
 * Goes beyond Core Web Vitals to measure:
 * - API response times per endpoint (p50/p95/p99)
 * - Time to first game data render
 * - Full page weight (transfer size)
 * - Memory usage snapshots
 * - Navigation timing across all key pages
 * - Comparison against third-party provider latencies
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

interface ExtPerfResult {
  test: string;
  details: Record<string, unknown>;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

test.describe("Audit: Extended performance metrics", () => {
  test.setTimeout(120_000);
  const results: ExtPerfResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `perf-extended-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("API response time profiling (10 samples per endpoint)", async ({
    request,
  }) => {
    const endpoints = [
      "/api/health",
      "/api/games",
      "/api/golf/tournaments",
      "/api/fairbet/odds",
    ];

    const profile: Record<
      string,
      { avg: number; p50: number; p95: number; min: number; max: number; samples: number[] }
    > = {};

    for (const ep of endpoints) {
      const timings: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        try {
          await request.get(ep);
          timings.push(Date.now() - start);
        } catch {
          timings.push(Date.now() - start);
        }
      }

      const sorted = [...timings].sort((a, b) => a - b);
      profile[ep] = {
        avg: Math.round(timings.reduce((s, t) => s + t, 0) / timings.length),
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        samples: timings,
      };
    }

    results.push({ test: "api-response-profile", details: profile });

    // Health pings the upstream backend which can be slow — allow up to 10s at p95
    expect(profile["/api/health"].p95).toBeLessThan(10_000);
    // Games proxies through upstream API which can be slow / rate-limited
    expect(profile["/api/games"].p95).toBeLessThan(15_000);
  });

  test("time to first game data render", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();

    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Wait for either game rows or "no games" message
    await Promise.race([
      page
        .locator("[data-testid='game-row']")
        .first()
        .waitFor({ state: "visible", timeout: 20_000 }),
      page.locator("text=No games").first().waitFor({ state: "visible", timeout: 20_000 }),
    ]).catch(() => {
      /* timeout is fine, we'll record it */
    });

    const timeToData = Date.now() - start;

    results.push({
      test: "time-to-first-data",
      details: { timeToDataMs: timeToData },
    });

    // Should render game data within 30 seconds (backend can be slow)
    expect(timeToData).toBeLessThan(30_000);

    await page.close();
    await ctx.close();
  });

  test("page weight (transfer size) analysis", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();

    const transferSizes: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};

    page.on("response", (res) => {
      const url = new URL(res.url());
      const ext =
        url.pathname.split(".").pop()?.split("?")[0] ?? "other";
      const type =
        ext === "js"
          ? "js"
          : ext === "css"
            ? "css"
            : ext === "json"
              ? "json"
              : url.pathname.startsWith("/api/")
                ? "api"
                : "other";

      const headers = res.headers();
      const contentLength = parseInt(headers["content-length"] ?? "0");
      transferSizes[type] = (transferSizes[type] ?? 0) + contentLength;
      resourceCounts[type] = (resourceCounts[type] ?? 0) + 1;
    });

    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(5_000);

    const totalBytes = Object.values(transferSizes).reduce((s, v) => s + v, 0);

    results.push({
      test: "page-weight",
      details: {
        transferByType: transferSizes,
        resourceCounts,
        totalBytes,
        totalKB: Math.round(totalBytes / 1024),
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      },
    });

    // JS bundle should be under 2MB transferred
    expect(transferSizes["js"] ?? 0).toBeLessThan(2 * 1024 * 1024);

    await page.close();
    await ctx.close();
  });

  test("memory usage snapshot", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();

    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(5_000);

    // Try to get memory info (only available in some environments)
    const memory = await page
      .evaluate(() => {
        const perf = performance as Performance & {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        };
        if (perf.memory) {
          return {
            usedHeapMB: (perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
            totalHeapMB: (perf.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
            heapLimitMB: (perf.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2),
          };
        }
        return null;
      })
      .catch(() => null);

    results.push({
      test: "memory-usage",
      details: { memory: memory ?? "not available (requires --enable-precise-memory-info)" },
    });

    await page.close();
    await ctx.close();
  });

  test("navigation timing across all key pages", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const pages = [
      { name: "home", url: "/" },
      { name: "golf", url: "/golf" },
      { name: "fairbet", url: "/fairbet" },
      { name: "login", url: "/login" },
    ];

    const timings: Record<string, Awaited<ReturnType<typeof collectPerformanceMetrics>>> = {};

    for (const pg of pages) {
      const page = await ctx.newPage();
      await page.goto(pg.url, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(2_000);

      try {
        timings[pg.name] = await collectPerformanceMetrics(page);
      } catch {
        timings[pg.name] = {
          domContentLoaded: -1,
          loadComplete: -1,
          firstByte: -1,
          domInteractive: -1,
        };
      }

      await page.close();
    }

    results.push({ test: "navigation-timing", details: timings });

    // Home page should load under 8 seconds
    expect(timings.home?.loadComplete ?? 99999).toBeLessThan(8_000);

    await ctx.close();
  });

  test("third-party latency comparison (ESPN vs CBS vs Scroll Down)", async ({
    request,
  }) => {
    async function timeRequest(url: string, samples: number = 5): Promise<number[]> {
      const timings: number[] = [];
      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        try {
          await request.get(url);
          timings.push(Date.now() - start);
        } catch {
          timings.push(Date.now() - start);
        }
      }
      return timings;
    }

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

    const [sdTimings, espnTimings, cbsTimings] = await Promise.all([
      timeRequest("/api/games", 5),
      timeRequest(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today}`,
        5,
      ),
      timeRequest("https://www.cbssports.com/nba/scoreboard/", 3),
    ]);

    const avg = (arr: number[]) =>
      Math.round(arr.reduce((s, t) => s + t, 0) / arr.length);
    const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);

    results.push({
      test: "third-party-latency-comparison",
      details: {
        scrollDown: {
          avg: avg(sdTimings),
          p50: percentile(sorted(sdTimings), 50),
          p95: percentile(sorted(sdTimings), 95),
          samples: sdTimings,
        },
        espn: {
          avg: avg(espnTimings),
          p50: percentile(sorted(espnTimings), 50),
          p95: percentile(sorted(espnTimings), 95),
          samples: espnTimings,
        },
        cbs: {
          avg: avg(cbsTimings),
          p50: percentile(sorted(cbsTimings), 50),
          p95: percentile(sorted(cbsTimings), 95),
          samples: cbsTimings,
        },
        sdVsEspnFactor: (avg(sdTimings) / avg(espnTimings)).toFixed(2),
        sdVsCbsFactor: (avg(cbsTimings) > 0 ? avg(sdTimings) / avg(cbsTimings) : null),
      },
    });
  });

  test("repeated navigation measures caching benefit", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();

    // Cold load
    const coldStart = Date.now();
    await page.goto("/", { waitUntil: "load" });
    await waitForLoad(page);
    const coldMs = Date.now() - coldStart;

    // Warm load (back + forward)
    await page.goto("/golf", { waitUntil: "load" });
    await page.waitForTimeout(1_000);

    const warmStart = Date.now();
    await page.goto("/", { waitUntil: "load" });
    await waitForLoad(page);
    const warmMs = Date.now() - warmStart;

    // Same-page reload
    const reloadStart = Date.now();
    await page.reload({ waitUntil: "load" });
    await waitForLoad(page);
    const reloadMs = Date.now() - reloadStart;

    results.push({
      test: "cache-benefit",
      details: {
        coldLoadMs: coldMs,
        warmLoadMs: warmMs,
        reloadMs: reloadMs,
        warmVsColdRatio: (warmMs / coldMs).toFixed(2),
        reloadVsColdRatio: (reloadMs / coldMs).toFixed(2),
      },
    });

    await page.close();
    await ctx.close();
  });
});

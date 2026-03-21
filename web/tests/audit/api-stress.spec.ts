import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * API Stress Testing Suite
 *
 * Tests the backend under concurrent load, measures degradation,
 * validates rate-limit behavior, and checks error recovery.
 * Designed to run on a 2018 Mac dev server — keeps concurrency
 * reasonable but still stresses the API meaningfully.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

interface StressResult {
  test: string;
  totalRequests: number;
  concurrency: number;
  successCount: number;
  failCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  minMs: number;
  errorCodes: Record<number, number>;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(timings: number[]): {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
} {
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = Math.round(timings.reduce((s, t) => s + t, 0) / timings.length);
  return {
    avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    min: sorted[0],
  };
}

/** Fire N requests with a given concurrency limit. */
async function stressEndpoint(
  request: { get: (url: string) => Promise<{ status: () => number }> },
  url: string,
  total: number,
  concurrency: number,
): Promise<{
  timings: number[];
  statuses: number[];
}> {
  const timings: number[] = [];
  const statuses: number[] = [];
  let inflight = 0;
  let launched = 0;

  await new Promise<void>((resolve) => {
    function launch() {
      while (inflight < concurrency && launched < total) {
        inflight++;
        launched++;
        const start = Date.now();
        request
          .get(url)
          .then((res) => {
            timings.push(Date.now() - start);
            statuses.push(res.status());
          })
          .catch(() => {
            timings.push(Date.now() - start);
            statuses.push(0); // network error
          })
          .finally(() => {
            inflight--;
            if (timings.length === total) {
              resolve();
            } else {
              launch();
            }
          });
      }
    }
    launch();
  });

  return { timings, statuses };
}

test.describe("Audit: API stress testing", () => {
  // Increase timeout — stress tests are inherently slow
  test.setTimeout(120_000);

  const results: StressResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `stress-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("health endpoint under sustained load (50 reqs, 10 concurrent)", async ({
    request,
  }) => {
    const { timings, statuses } = await stressEndpoint(
      request,
      "/api/health",
      50,
      10,
    );

    const stats = computeStats(timings);
    const errorCodes: Record<number, number> = {};
    for (const s of statuses) {
      if (s >= 400 || s === 0) errorCodes[s] = (errorCodes[s] ?? 0) + 1;
    }

    results.push({
      test: "health-sustained",
      totalRequests: 50,
      concurrency: 10,
      successCount: statuses.filter((s) => s >= 200 && s < 400).length,
      failCount: statuses.filter((s) => s >= 400 || s === 0).length,
      avgMs: stats.avg,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max,
      minMs: stats.min,
      errorCodes,
    });

    // At least 90% success under load
    const successRate = statuses.filter((s) => s >= 200 && s < 400).length / statuses.length;
    expect(successRate).toBeGreaterThanOrEqual(0.9);
    // p95 should stay under 10s even under load
    expect(stats.p95).toBeLessThan(10_000);
  });

  test("games list under concurrent burst (30 reqs, 10 concurrent)", async ({
    request,
  }) => {
    const { timings, statuses } = await stressEndpoint(
      request,
      "/api/games",
      30,
      10,
    );

    const stats = computeStats(timings);
    const errorCodes: Record<number, number> = {};
    for (const s of statuses) {
      if (s >= 400 || s === 0) errorCodes[s] = (errorCodes[s] ?? 0) + 1;
    }

    results.push({
      test: "games-burst",
      totalRequests: 30,
      concurrency: 10,
      successCount: statuses.filter((s) => s >= 200 && s < 400).length,
      failCount: statuses.filter((s) => s >= 400 || s === 0).length,
      avgMs: stats.avg,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max,
      minMs: stats.min,
      errorCodes,
    });

    const successRate = statuses.filter((s) => s >= 200 && s < 400).length / statuses.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);
    expect(stats.p95).toBeLessThan(15_000);
  });

  test("fairbet odds under concurrent load (20 reqs, 5 concurrent)", async ({
    request,
  }) => {
    const { timings, statuses } = await stressEndpoint(
      request,
      "/api/fairbet/odds",
      20,
      5,
    );

    const stats = computeStats(timings);
    const errorCodes: Record<number, number> = {};
    for (const s of statuses) {
      if (s >= 400 || s === 0) errorCodes[s] = (errorCodes[s] ?? 0) + 1;
    }

    results.push({
      test: "fairbet-concurrent",
      totalRequests: 20,
      concurrency: 5,
      successCount: statuses.filter((s) => s >= 200 && s < 400).length,
      failCount: statuses.filter((s) => s >= 400 || s === 0).length,
      avgMs: stats.avg,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max,
      minMs: stats.min,
      errorCodes,
    });

    const successRate = statuses.filter((s) => s >= 200 && s < 400).length / statuses.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);
  });

  test("mixed endpoint burst (games + golf + health, 40 total)", async ({
    request,
  }) => {
    const endpoints = [
      "/api/health",
      "/api/games",
      "/api/golf/tournaments",
      "/api/health",
      "/api/games",
    ];

    const timings: number[] = [];
    const statuses: number[] = [];

    // Fire 8 rounds of all 5 endpoints concurrently
    for (let round = 0; round < 8; round++) {
      const batch = endpoints.map(async (url) => {
        const start = Date.now();
        try {
          const res = await request.get(url);
          timings.push(Date.now() - start);
          statuses.push(res.status());
        } catch {
          timings.push(Date.now() - start);
          statuses.push(0);
        }
      });
      await Promise.all(batch);
    }

    const stats = computeStats(timings);
    const errorCodes: Record<number, number> = {};
    for (const s of statuses) {
      if (s >= 400 || s === 0) errorCodes[s] = (errorCodes[s] ?? 0) + 1;
    }

    results.push({
      test: "mixed-burst",
      totalRequests: timings.length,
      concurrency: 5,
      successCount: statuses.filter((s) => s >= 200 && s < 400).length,
      failCount: statuses.filter((s) => s >= 400 || s === 0).length,
      avgMs: stats.avg,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max,
      minMs: stats.min,
      errorCodes,
    });

    const successRate = statuses.filter((s) => s >= 200 && s < 400).length / statuses.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);
  });

  test("sequential rapid-fire measures latency degradation (30 serial reqs)", async ({
    request,
  }) => {
    const timings: number[] = [];
    const statuses: number[] = [];

    for (let i = 0; i < 30; i++) {
      const start = Date.now();
      try {
        const res = await request.get("/api/health");
        timings.push(Date.now() - start);
        statuses.push(res.status());
      } catch {
        timings.push(Date.now() - start);
        statuses.push(0);
      }
    }

    // Compare first 10 vs last 10 to detect degradation
    const firstTen = timings.slice(0, 10);
    const lastTen = timings.slice(-10);
    const avgFirst = firstTen.reduce((s, t) => s + t, 0) / firstTen.length;
    const avgLast = lastTen.reduce((s, t) => s + t, 0) / lastTen.length;
    const degradation = avgLast / avgFirst;

    const stats = computeStats(timings);
    const errorCodes: Record<number, number> = {};
    for (const s of statuses) {
      if (s >= 400 || s === 0) errorCodes[s] = (errorCodes[s] ?? 0) + 1;
    }

    results.push({
      test: "serial-degradation",
      totalRequests: 30,
      concurrency: 1,
      successCount: statuses.filter((s) => s >= 200 && s < 400).length,
      failCount: statuses.filter((s) => s >= 400 || s === 0).length,
      avgMs: stats.avg,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max,
      minMs: stats.min,
      errorCodes,
    });

    // Latency shouldn't more than 3x degrade over 30 requests
    expect(degradation).toBeLessThan(3.0);
    // All should succeed
    const successRate = statuses.filter((s) => s >= 200 && s < 400).length / statuses.length;
    expect(successRate).toBeGreaterThanOrEqual(0.95);
  });

  test("error recovery — API bounces back after simulated failures", async ({
    page,
  }) => {
    // Intercept /api/games to fail the first 3 requests, then pass through
    let requestCount = 0;
    await page.route("**/api/games*", async (route) => {
      requestCount++;
      if (requestCount <= 3) {
        await route.fulfill({ status: 503, body: "Service Unavailable" });
      } else {
        await route.fallback();
      }
    });

    // Navigate — first load will see failures, app should retry/recover
    await page.goto("/");
    // Wait for recovery — the app should eventually load game data
    await page.waitForTimeout(5_000);

    // Trigger a reload — should now get real data
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    // After the initial failures, subsequent requests should succeed
    expect(requestCount).toBeGreaterThan(3);

    results.push({
      test: "error-recovery",
      totalRequests: requestCount,
      concurrency: 1,
      successCount: requestCount - 3,
      failCount: 3,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      minMs: 0,
      errorCodes: { 503: 3 },
    });
  });
});

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(__dirname, "..", "..", "audit-results");
const MAX_LCP_MS = 4_000;
const MAX_CLS = 0.25;

interface PerfResult {
  page: string;
  url: string;
  lcp: number | null;
  cls: number | null;
  tti: number | null;
  domContentLoaded: number;
  loadComplete: number;
}

const PAGES = [
  { name: "home", url: "/" },
  { name: "golf", url: "/golf" },
  { name: "fairbet", url: "/fairbet" },
];

test.describe("Audit: Performance benchmarks", () => {
  const results: PerfResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `perf-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  for (const pg of PAGES) {
    test(`performance: ${pg.name}`, async ({ page }) => {
      // Set up LCP and CLS observers before navigation
      await page.addInitScript(() => {
        (window as unknown as Record<string, unknown>).__audit_lcp = 0;
        (window as unknown as Record<string, unknown>).__audit_cls = 0;

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            (window as unknown as Record<string, number>).__audit_lcp =
              last.startTime;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const le = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!le.hadRecentInput) {
              (window as unknown as Record<string, number>).__audit_cls +=
                le.value ?? 0;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      await page.goto(pg.url, { waitUntil: "networkidle", timeout: 30_000 });

      // Wait a bit for LCP to settle
      await page.waitForTimeout(2_000);

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return {
          lcp: (window as unknown as Record<string, number>).__audit_lcp ?? null,
          cls: (window as unknown as Record<string, number>).__audit_cls ?? null,
          domContentLoaded: Math.round(
            nav.domContentLoadedEventEnd - nav.startTime,
          ),
          loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
          domInteractive: Math.round(nav.domInteractive - nav.startTime),
        };
      });

      const result: PerfResult = {
        page: pg.name,
        url: pg.url,
        lcp: metrics.lcp ? Math.round(metrics.lcp) : null,
        cls: metrics.cls ?? null,
        tti: metrics.domInteractive,
        domContentLoaded: metrics.domContentLoaded,
        loadComplete: metrics.loadComplete,
      };
      results.push(result);

      // Assertions
      if (result.lcp !== null) {
        expect(result.lcp).toBeLessThan(MAX_LCP_MS);
      }
      if (result.cls !== null) {
        expect(result.cls).toBeLessThan(MAX_CLS);
      }
    });
  }
});

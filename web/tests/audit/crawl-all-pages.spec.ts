import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");

interface PageAuditResult {
  url: string;
  name: string;
  timestamp: string;
  screenshot: string;
  performance: {
    domContentLoaded: number;
    loadComplete: number;
    firstByte: number;
    domInteractive: number;
  } | null;
  consoleErrors: string[];
  brokenImages: string[];
  overflowElements: number;
  passed: boolean;
}

// Static pages
const STATIC_PAGES = [
  { name: "home", url: "/" },
  { name: "golf", url: "/golf" },
  { name: "fairbet", url: "/fairbet" },
  { name: "login", url: "/login" },
];

test.describe("Audit: Crawl all pages", () => {
  const results: PageAuditResult[] = [];

  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  });

  test.afterAll(() => {
    const reportPath = path.join(RESULTS_DIR, "crawl-results.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  });

  for (const page of STATIC_PAGES) {
    test(`audit static page: ${page.name}`, async ({ page: p }) => {
      const result = await auditPage(p, page.url, page.name);
      results.push(result);
      expect(result.consoleErrors).toHaveLength(0);
      expect(result.brokenImages).toHaveLength(0);
    });
  }

  test("audit dynamic game pages", async ({ page: p, request }) => {
    // Get valid game IDs from API
    const gamesRes = await request.get("/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }
    const gamesData = await gamesRes.json();
    const gameIds: string[] = (gamesData.games ?? [])
      .slice(0, 3)
      .map((g: { id: string | number }) => String(g.id));

    for (const id of gameIds) {
      const result = await auditPage(p, `/game/${id}`, `game-${id}`);
      results.push(result);
    }
  });

  test("audit dynamic golf event pages", async ({ page: p, request }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }
    const tourData = await tourRes.json();
    const eventIds: string[] = (tourData.tournaments ?? [])
      .slice(0, 2)
      .map((t: { event_id: string }) => t.event_id);

    for (const id of eventIds) {
      const result = await auditPage(p, `/golf/${id}`, `golf-event-${id}`);
      results.push(result);
    }
  });
});

async function auditPage(
  page: import("@playwright/test").Page,
  url: string,
  name: string,
): Promise<PageAuditResult> {
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore resource loading errors (e.g. SSE, realtime, or prefetch 400s)
      if (text.includes("Failed to load resource")) return;
      consoleErrors.push(text);
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("load");

  // Screenshot
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Performance metrics
  let performance: PageAuditResult["performance"] = null;
  try {
    performance = await page.evaluate(() => {
      const nav = window.performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (!nav) return null;
      return {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
        firstByte: Math.round(nav.responseStart - nav.startTime),
        domInteractive: Math.round(nav.domInteractive - nav.startTime),
      };
    });
  } catch {
    // metrics unavailable
  }

  // Broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    const broken: string[] = [];
    imgs.forEach((img) => {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push(img.src || img.getAttribute("data-src") || "unknown");
      }
    });
    return broken;
  });

  // Overflow detection
  const overflowElements = await page.evaluate(() => {
    let count = 0;
    const docWidth = document.documentElement.clientWidth;
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 5 || rect.left < -5) {
        count++;
      }
    });
    return count;
  });

  return {
    url,
    name,
    timestamp: new Date().toISOString(),
    screenshot: screenshotPath,
    performance,
    consoleErrors,
    brokenImages,
    overflowElements,
    passed: consoleErrors.length === 0 && brokenImages.length === 0,
  };
}

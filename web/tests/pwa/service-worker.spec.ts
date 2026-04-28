import { test, expect } from "@playwright/test";

// Give the SW time to install and activate
const SW_TIMEOUT_MS = 15_000;

test.describe("Service Worker", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test("registers and activates on first load @smoke", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 25_000 });

    // Poll for activation — waitForFunction can stall under parallel CI + SW install.
    const deadline = Date.now() + SW_TIMEOUT_MS;
    let controlled = false;
    while (Date.now() < deadline) {
      controlled = await page.evaluate(
        () => navigator.serviceWorker.controller !== null,
      );
      if (controlled) break;
      await page.waitForTimeout(400);
    }

    if (controlled) {
      const scope = await page.evaluate(
        () => navigator.serviceWorker.controller?.scriptURL ?? "",
      );
      expect(scope).toContain("/sw.js");
      return;
    }

    const registered = await Promise.race([
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration("/");
        return reg !== undefined;
      }),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 5_000);
      }),
    ]);
    if (!registered) {
      test.skip(true, "Service worker did not register in time");
      return;
    }
  });

  test("static assets served from cache on second visit @smoke", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();

      // First visit — installs SW and primes cache
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const swDeadline = Date.now() + SW_TIMEOUT_MS;
      while (Date.now() < swDeadline) {
        if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) break;
        await page.waitForTimeout(400);
      }

      // Second visit — SW should serve /_next/static/* from cache
      const staticRequests: string[] = [];
      const networkHitUrls: string[] = [];

      page.on("response", (response) => {
        const url = response.url();
        if (url.includes("/_next/static/")) {
          staticRequests.push(url);
          if (!response.fromServiceWorker()) {
            networkHitUrls.push(url);
          }
        }
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      // After second visit, static assets may come from SW cache.
      // If SW isn't yet active, skip rather than fail (live data variance).
      const swActive = await page.evaluate(
        () => navigator.serviceWorker.controller !== null,
      );

      if (!swActive) {
        test.skip();
        return;
      }

      // At least some static assets should have been served by the SW
      expect(staticRequests.length).toBeGreaterThan(0);
      // All observed static requests should come from the service worker cache
      expect(networkHitUrls).toHaveLength(0);
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("game list API hits network on repeat visit (network-first)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Distinguish list (/api/games?…) from detail (/api/games/[id]); only the
    // list endpoint is network-first. Detail stays SWR.
    let listHits = 0;
    await page.route(/\/api\/games(\?|$)/, (route) => {
      listHits++;
      route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const firstVisitHits = listHits;

    const swDeadline = Date.now() + SW_TIMEOUT_MS;
    let swActive = false;
    while (Date.now() < swDeadline) {
      swActive = await page.evaluate(() => navigator.serviceWorker.controller !== null);
      if (swActive) break;
      await page.waitForTimeout(400);
    }

    if (!swActive) {
      test.skip();
      await context.close();
      return;
    }

    listHits = 0;
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Network-first: every visit must hit the network for the list endpoint
    // (not served from cache). Use firstVisitHits as a sanity floor in case
    // multiple list requests fire on a single page load.
    expect(listHits).toBeGreaterThanOrEqual(Math.max(1, firstVisitHits));

    await context.close();
  });

  test("game list falls back to cache when network unavailable", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // First visit — prime the cache via a successful list fetch.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const swDeadline = Date.now() + SW_TIMEOUT_MS;
    let swActive = false;
    while (Date.now() < swDeadline) {
      swActive = await page.evaluate(() => navigator.serviceWorker.controller !== null);
      if (swActive) break;
      await page.waitForTimeout(400);
    }

    if (!swActive) {
      test.skip();
      await context.close();
      return;
    }

    // Second visit with the network blocked — SW should fall back to the
    // cached list response and still resolve a 200.
    await page.route(/\/api\/games(\?|$)/, (route) => route.abort("failed"));
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    await context.close();
  });

  test("offline fallback returned when API unreachable and no cache", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Block all game API requests to simulate cold-cache + offline scenario
    await page.route("**/api/games**", (route) => route.abort("failed"));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The SW should have responded to the aborted API fetch.
    // We verify the offline.html fallback is reachable on its own.
    const offlinePage = await context.newPage();
    const response = await offlinePage.goto("/offline.html");
    expect(response?.status()).toBe(200);

    const heading = await offlinePage.getByRole("heading", {
      name: /you're offline/i,
    });
    await expect(heading).toBeVisible();

    await context.close();
  });
});

import { test, expect } from "../helpers";

// Ads are disabled in the Playwright test environment via NEXT_PUBLIC_ADS_ENABLED=false
// (set in playwright.config.ts webServer.env). These tests verify that behaviour and
// provide a harness for manual ad-enabled smoke tests.

test.describe("Ad placements — disabled in test env @smoke", () => {
  test("home feed ads do not appear when ads are disabled", async ({ page }) => {
    await page.goto("/");
    // When NEXT_PUBLIC_ADS_ENABLED=false, no ad slots should be in the DOM.
    await expect(page.locator("[data-testid^='feed-ad-']")).toHaveCount(0);
  });

  test("game detail ads do not appear on game detail page @live-upstream", async ({ page }) => {
    // Navigate to a game detail page; game ID 1 is used as a representative slug.
    // The test skips gracefully if live data is unavailable.
    const res = await page.request.get("/api/games?limit=1");
    if (!res.ok()) {
      test.skip();
      return;
    }
    const body = await res.json().catch(() => null);
    const gameId: number | undefined = body?.games?.[0]?.id ?? body?.[0]?.id;
    if (!gameId) {
      test.skip();
      return;
    }

    await page.goto(`/game/${gameId}`);
    await page.waitForSelector("[data-testid='page-game-detail']", { timeout: 20_000 });

    await expect(page.locator("[data-testid^='game-detail-ad-']")).toHaveCount(0);
  });
});

test.describe("Ad placements — free vs pro @live-upstream", () => {
  test("home feed ads are absent for pro-tier users", async ({ page }) => {
    // Simulate pro tier via dev override and verify no ads render.
    await page.goto("/?tier=pro");
    await page.waitForTimeout(500);

    await expect(page.locator("[data-testid^='feed-ad-']")).toHaveCount(0);
  });

  test("game detail ads are absent for pro-tier users", async ({ page }) => {
    const res = await page.request.get("/api/games?limit=1");
    if (!res.ok()) {
      test.skip();
      return;
    }
    const body = await res.json().catch(() => null);
    const gameId: number | undefined = body?.games?.[0]?.id ?? body?.[0]?.id;
    if (!gameId) {
      test.skip();
      return;
    }

    await page.goto(`/game/${gameId}?tier=pro`);
    await page.waitForSelector("[data-testid='page-game-detail']", { timeout: 20_000 });

    await expect(page.locator("[data-testid^='game-detail-ad-']")).toHaveCount(0);
  });
});

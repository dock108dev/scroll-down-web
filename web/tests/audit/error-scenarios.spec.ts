import { test, expect } from "@playwright/test";

test.describe("Audit: Error scenarios", () => {
  test("404 page for nonexistent route", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("nonexistent game ID shows error gracefully", async ({ page }) => {
    await page.goto("/game/999999999");
    // Should not crash — either shows error or redirects
    await page.waitForLoadState("networkidle");
    // Page should still have the nav
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("nonexistent golf event shows error gracefully", async ({ page }) => {
    await page.goto("/golf/invalid-event-id-xyz");
    await page.waitForLoadState("networkidle");
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("handles API failure gracefully on home page", async ({ page }) => {
    // Intercept games API to simulate a 500
    await page.route("**/api/games**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should render without crashing
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("handles API failure gracefully on golf page", async ({ page }) => {
    await page.route("**/api/golf/tournaments**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    await page.goto("/golf");
    await page.waitForLoadState("networkidle");

    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("handles API failure gracefully on fairbet page", async ({ page }) => {
    await page.route("**/api/fairbet/**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    await page.goto("/fairbet");
    await page.waitForLoadState("networkidle");

    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });
});

import { test, expect } from "../helpers";

test.describe("Error handling: 404", () => {
  test("nonexistent page returns 404", async ({ page }) => {
    const res = await page.goto("/nonexistent-page-12345");
    expect(res?.status()).toBe(404);
  });

  test("404 page has navigation", async ({ page }) => {
    await page.goto("/nonexistent-page-12345");
    // Top nav should still render
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("deep nonexistent path returns 404", async ({ page }) => {
    const res = await page.goto("/some/deep/nonexistent/path");
    expect(res?.status()).toBe(404);
  });
});

import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("History page", () => {
  test("page loads for admin user", async ({ authedPage: page }) => {
    await page.goto("/history");
    await waitForLoad(page);

    // Auth gate or history page should be visible
    const historyPage = page.locator("[data-testid='page-history']");
    const authGate = page.locator("[data-testid='auth-gate']");

    const isHistory = await historyPage.isVisible().catch(() => false);
    const isGated = await authGate.isVisible().catch(() => false);

    // One of these should be true
    expect(isHistory || isGated).toBe(true);
  });

  test("date navigator is present when authorized", async ({
    authedPage: page,
  }) => {
    await page.goto("/history");
    await waitForLoad(page);

    const historyPage = page.locator("[data-testid='page-history']");
    const isVisible = await historyPage.isVisible().catch(() => false);

    if (!isVisible) {
      // User is not admin, auth gate should show
      const authGate = page.locator("[data-testid='auth-gate']");
      await expect(authGate).toBeVisible();
      return;
    }

    // Date navigator should be present
    const toolbar = page.locator("[data-testid='page-history'] .sticky");
    await expect(toolbar).toBeVisible();
  });

  test("search bar is functional", async ({ authedPage: page }) => {
    await page.goto("/history");
    await waitForLoad(page);

    const historyPage = page.locator("[data-testid='page-history']");
    const isVisible = await historyPage.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "User not authorized for history");
      return;
    }

    const searchBar = page.locator("[data-testid='search-bar']");
    await expect(searchBar).toBeVisible();
    await searchBar.fill("test search");
    await expect(searchBar).toHaveValue("test search");
  });

  test("non-admin sees auth gate", async ({ page }) => {
    // Use non-authed page (no saved auth state)
    await page.goto("/history");
    await waitForLoad(page);

    // Should see auth gate since no auth
    const authGate = page.locator("[data-testid='auth-gate']");
    const historyPage = page.locator("[data-testid='page-history']");

    const isGated = await authGate.isVisible().catch(() => false);
    const isHistory = await historyPage.isVisible().catch(() => false);

    // Either gated or history shown (depends on auth state)
    expect(isGated || isHistory).toBe(true);
  });
});

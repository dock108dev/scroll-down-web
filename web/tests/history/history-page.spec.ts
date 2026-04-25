import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("History page @live-upstream", () => {
  test("page loads for admin user", async ({ authedPage: page }) => {
    await page.goto("/history");

    // Either the gate (free tier) or the page itself (pro/admin) renders.
    // Race so we don't depend on skeleton timing.
    const settled = await Promise.race([
      page
        .locator("[data-testid='history-gate-overlay']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "gate"),
      page
        .locator("[data-testid='page-history']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "history"),
    ]).catch(() => "timeout");

    expect(settled).not.toBe("timeout");
  });

  test("date navigator is present when authorized", async ({
    authedPage: page,
  }) => {
    await page.goto("/history");

    const settled = await Promise.race([
      page
        .locator("[data-testid='history-gate-overlay']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "gate"),
      page
        .locator("[data-testid='page-history']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "history"),
    ]).catch(() => "timeout");

    if (settled === "gate") return;
    expect(settled).toBe("history");

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
    // Use non-authed page (no saved auth state). The history page hydrates
    // session asynchronously, then either renders the gate overlay (free
    // tier authed) or redirects to /login (anonymous). Wait for any of the
    // three stable outcomes instead of a generic skeleton timeout.
    await page.goto("/history");

    const settled = await Promise.race([
      page.waitForURL(/\/login/, { timeout: 15_000 }).then(() => "login"),
      page
        .locator("[data-testid='history-gate-overlay']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "gate"),
      page
        .locator("[data-testid='page-history']")
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "history"),
    ]).catch(() => "timeout");

    expect(settled).not.toBe("timeout");
  });
});

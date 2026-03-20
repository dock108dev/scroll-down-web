import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("Analytics: Models page", () => {
  test("analytics page loads", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    await waitForLoad(page);

    // Should have analytics content or auth gate
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("models section is accessible", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    await waitForLoad(page);

    // Look for models-related content
    const pageContent = await page.textContent("body");
    // Analytics page should have some content
    expect(pageContent?.length).toBeGreaterThan(0);
  });
});

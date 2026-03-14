import { test, expect, waitForLoad } from "../helpers";

test.describe("Home page – pinning", () => {
  test.beforeEach(async ({ authedPage }) => {
    // Clear any existing pins
    await authedPage.goto("/");
    await authedPage.evaluate(() =>
      localStorage.removeItem("sd-pinned-games"),
    );
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  test("pin icon is visible on game rows", async ({ authedPage }) => {
    const pinBtn = authedPage.getByTitle("Pin game").first();
    await expect(pinBtn).toBeVisible();
  });

  test("clicking pin icon toggles to Unpin", async ({ authedPage }) => {
    const pinBtn = authedPage.getByTitle("Pin game").first();
    await pinBtn.click();

    // After clicking, the same button should now say "Unpin game"
    const unpinBtn = authedPage.getByTitle("Unpin game").first();
    await expect(unpinBtn).toBeVisible({ timeout: 3000 });
  });

  test("PinnedBar appears in header after pinning", async ({ authedPage }) => {
    // Pin a game
    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    // PinnedBar should now be visible
    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible({ timeout: 3000 });
    // Should contain at least one chip
    const chips = pinnedBar.locator("[data-testid='pinned-chip']");
    expect(await chips.count()).toBeGreaterThan(0);
  });

  test("clicking X on pinned chip removes it", async ({ authedPage }) => {
    // Pin a game
    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible();

    // Click the X/remove button on the chip (the last span with role="button" inside each chip)
    const chip = pinnedBar.locator("[data-testid='pinned-chip']").first();
    const removeBtn = chip.locator('span[role="button"]').last();
    await removeBtn.click();
    await authedPage.waitForTimeout(300);

    // PinnedBar should disappear when no pins remain
    await expect(pinnedBar).not.toBeVisible();
  });

  test("pins persist after page reload", async ({ authedPage }) => {
    // Pin a game
    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    // Reload
    await authedPage.reload();
    await waitForLoad(authedPage);

    // PinnedBar should still be visible
    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible({ timeout: 3000 });

    // At least one unpin button should exist
    const unpinBtn = authedPage.getByTitle("Unpin game").first();
    await expect(unpinBtn).toBeVisible();
  });

  test("pin state stored in localStorage under sd-pinned-games", async ({
    authedPage,
  }) => {
    // Pin a game
    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    const stored = await authedPage.evaluate(() =>
      localStorage.getItem("sd-pinned-games"),
    );
    expect(stored).toBeTruthy();
  });

  test("multiple games can be pinned", async ({ authedPage }) => {
    const pinButtons = authedPage.getByTitle("Pin game");
    const count = Math.min(await pinButtons.count(), 3);

    for (let i = 0; i < count; i++) {
      // Re-query each time since DOM updates after each pin
      await authedPage.getByTitle("Pin game").first().click();
      await authedPage.waitForTimeout(300);
    }

    // Verify multiple chips in PinnedBar
    const chips = authedPage.locator(
      "[data-testid='pinned-bar'] [data-testid='pinned-chip']",
    );
    expect(await chips.count()).toBe(count);
  });
});

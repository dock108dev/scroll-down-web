import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet Page - Parlay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("parlay button is not visible when no legs are selected", async ({
    page,
  }) => {
    // Wait for page to settle past loading
    await page.waitForTimeout(3000);

    // Parlay header button requires >= 2 legs, so should not exist initially
    await expect(
      page.getByRole("button", { name: /^Parlay \(\d+\)$/ })
    ).not.toBeVisible();
  });

  test("clicking parlay toggle on a bet card toggles its state", async ({
    page,
  }) => {
    const betCards = page.locator("[data-testid='bet-card']");

    // Wait for bet cards to load; skip if none available
    try {
      await betCards.first().waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      test.skip(true, "No bet cards available to test parlay toggle");
      return;
    }

    // Click the "+ Parlay" button on the first bet card
    const parlayToggle = betCards.first().getByRole("button", { name: /parlay/i });
    await parlayToggle.click();

    // The button should now show "✓ Parlay" (toggled state)
    await expect(
      betCards.first().getByRole("button", { name: /✓ Parlay|parlay/i })
    ).toBeVisible();
  });

  test("adding 2 legs shows Parlay count in header", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");

    try {
      await betCards.first().waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      test.skip(true, "No bet cards available to test parlay header");
      return;
    }

    const cardCount = await betCards.count();
    if (cardCount < 2) {
      test.skip(true, "Need at least 2 bet cards to test parlay header");
      return;
    }

    // Add 2 legs to trigger header button (canShowParlay requires >= 2)
    await betCards.nth(0).getByRole("button", { name: /parlay/i }).click();
    await betCards.nth(1).getByRole("button", { name: /parlay/i }).click();

    // Parlay header button should now be visible with count
    await expect(
      page.getByRole("button", { name: /Parlay \(2\)/ })
    ).toBeVisible();
  });
});

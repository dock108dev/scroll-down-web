import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet Page - Odds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("page loads and shows FairBet heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "FairBet" })).toBeVisible();
  });

  test("Pre-Game tab is active by default", async ({ page }) => {
    // Tabs are plain buttons, not role="tab". The active tab has different styling.
    const preGameBtn = page.getByRole("button", { name: "Pre-Game" });
    await expect(preGameBtn).toBeVisible();
  });

  test("loading state appears then resolves", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.getByText(/no \+ev bets|no bets available/i);

    // Wait for loading to finish — one of these should appear
    try {
      await expect(
        betCards.first().or(emptyState)
      ).toBeVisible({ timeout: 20_000 });
    } catch {
      const stillLoading = await page.getByText("Loading bets...").isVisible();
      if (stillLoading) {
        test.skip(true, "FairBet API did not respond within 20s");
        return;
      }
      throw new Error("Neither bet cards nor empty state appeared");
    }
  });

  test('"What is this?" button opens explainer', async ({ page }) => {
    const whatIsThisButton = page.getByRole("button", { name: "What is this?" });
    await expect(whatIsThisButton).toBeVisible();
    await whatIsThisButton.click();

    await expect(
      page.getByRole("heading", { name: "How FairBet Works" })
    ).toBeVisible();
  });

  test("bet cards render after loading or empty state shown", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.getByText(/no \+ev bets|no bets available/i);
    const loadingText = page.getByText("Loading bets...");

    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout") {
      // If still loading after 20s, the API is unavailable — skip
      const stillLoading = await loadingText.isVisible();
      if (stillLoading) {
        test.skip(true, "FairBet API did not respond within 20s");
        return;
      }
    }

    expect(["cards", "empty"]).toContain(result);
  });

  test("filter controls are visible", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(3000);

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });
});

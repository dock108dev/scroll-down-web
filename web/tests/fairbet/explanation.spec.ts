import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet - Fair Price Explanation @live-upstream", () => {
  test.beforeEach(async ({ proPage: page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  async function waitForBetCards(page: Parameters<typeof waitForLoad>[0]) {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");
    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");
    return result;
  }

  test("every bet card has a fairbet-explanation trigger @smoke", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    // Check up to 5 cards to keep test fast
    const limit = Math.min(cardCount, 5);
    for (let i = 0; i < limit; i++) {
      const trigger = cards.nth(i).locator("[data-testid='fairbet-explanation']");
      await expect(trigger).toBeVisible();
    }
  });

  test("tapping explanation trigger opens inline panel with plain-language text", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("[role='region'][aria-label='Fair price explanation']").first();
    await expect(panel).toBeVisible();
    const text = await panel.textContent() ?? "";
    expect(text).toMatch(/fair price/i);
    expect(text).toMatch(/margin|vig/i);
  });

  test("second tap on trigger closes the explanation panel", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await trigger.click();
    const panel = page.locator("[role='region'][aria-label='Fair price explanation']").first();
    await expect(panel).toBeVisible();

    await trigger.click();
    await expect(panel).not.toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape key closes the explanation panel", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await trigger.click();
    const panel = page.locator("[role='region'][aria-label='Fair price explanation']").first();
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
  });

  test("clicking outside the panel closes it", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await trigger.click();
    const panel = page.locator("[role='region'][aria-label='Fair price explanation']").first();
    await expect(panel).toBeVisible();

    // Click somewhere outside — the page heading is a safe target
    await page.getByRole("heading", { name: "FairBet" }).click();
    await expect(panel).not.toBeVisible();
  });

  test("explanation trigger is keyboard accessible", async ({ proPage: page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await trigger.focus();
    await page.keyboard.press("Enter");

    const panel = page.locator("[role='region'][aria-label='Fair price explanation']").first();
    await expect(panel).toBeVisible();

    await page.keyboard.press("Space");
    await expect(panel).not.toBeVisible();
  });
});

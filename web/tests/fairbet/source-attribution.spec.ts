import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet - Source Attribution @live-upstream", () => {
  test.beforeEach(async ({ page }) => {
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

  test("each bet card has a source attribution line @smoke", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    const limit = Math.min(cardCount, 5);
    for (let i = 0; i < limit; i++) {
      const attr = cards.nth(i).locator("[data-testid='fairbet-source-attribution']");
      await expect(attr).toBeVisible();
    }
  });

  test("attribution shows book count starting with 'From'", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const firstCard = page.locator("[data-testid='bet-card']").first();
    const attr = firstCard.locator("[data-testid='fairbet-source-attribution']");
    const text = await attr.textContent() ?? "";
    expect(text).toMatch(/^From \d+ books?/);
  });

  test("stale attribution has amber color when May be delayed", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    for (let i = 0; i < Math.min(cardCount, 20); i++) {
      const attr = cards.nth(i).locator("[data-testid='fairbet-source-attribution']");
      const text = await attr.textContent() ?? "";
      if (text.includes("May be delayed")) {
        const color = await attr.evaluate((el) => window.getComputedStyle(el).color);
        // amber: rgb(245, 158, 11)
        expect(color).toMatch(/rgb\(245,\s*158,\s*11\)/);
        return;
      }
    }
    // No stale cards found — skip rather than fail (data-dependent)
    test.skip(true, "No stale-odds cards found in sample");
  });

  test("fresh attribution has no timestamp suffix", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    // Check a sample of cards; if any are fresh they should lack 'ago'
    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      const attr = cards.nth(i).locator("[data-testid='fairbet-source-attribution']");
      const text = await attr.textContent() ?? "";
      if (!text.includes("ago") && !text.includes("delayed")) {
        // Fresh card — should be only "From N books"
        expect(text).toMatch(/^From \d+ books?$/);
        return;
      }
    }
    test.skip(true, "No fresh-odds cards found in sample");
  });
});

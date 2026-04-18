import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet - Book Comparison Row", () => {
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

  test("each bet card shows a book comparison row @smoke", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    const limit = Math.min(cardCount, 5);
    for (let i = 0; i < limit; i++) {
      const row = cards.nth(i).locator("[data-testid='book-comparison-row']");
      await expect(row).toBeVisible();
    }
  });

  test("book chips are present with correct data-testid pattern", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const firstCard = page.locator("[data-testid='bet-card']").first();
    const chips = firstCard.locator("[data-testid^='book-chip-']");
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);
  });

  test("chips display American odds in +/- format", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const firstCard = page.locator("[data-testid='bet-card']").first();
    const chips = firstCard.locator("[data-testid^='book-chip-']");
    const count = await chips.count();
    if (count === 0) return;

    const text = await chips.first().textContent() ?? "";
    expect(text).toMatch(/[+-]\d+/);
  });

  test("best-priced chip has green accent border when multiple books present", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    // Find a card with multiple book chips
    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    let multiBookCard = null;
    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      const chips = cards.nth(i).locator("[data-testid^='book-chip-']");
      const count = await chips.count();
      if (count >= 2) {
        multiBookCard = cards.nth(i);
        break;
      }
    }
    if (!multiBookCard) {
      test.skip(true, "No card with multiple books found");
      return;
    }

    // First chip in sorted order should have green accent border
    const firstChip = multiBookCard.locator("[data-testid^='book-chip-']").first();
    const borderColor = await firstChip.evaluate(
      (el) => window.getComputedStyle(el).borderColor
    );
    // Green accent = rgb(46, 184, 115)
    expect(borderColor).toMatch(/rgb\(46,\s*184,\s*115\)/);
  });

  test("single-book card shows chip without best highlighting", async ({ page }) => {
    const result = await waitForBetCards(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const cards = page.locator("[data-testid='bet-card']");
    const cardCount = await cards.count();
    let singleBookCard = null;
    for (let i = 0; i < Math.min(cardCount, 20); i++) {
      const chips = cards.nth(i).locator("[data-testid^='book-chip-']");
      const count = await chips.count();
      if (count === 1) {
        singleBookCard = cards.nth(i);
        break;
      }
    }
    if (!singleBookCard) {
      test.skip(true, "No single-book card found in sample");
      return;
    }

    // Single book chip should NOT have the green accent border
    const chip = singleBookCard.locator("[data-testid^='book-chip-']").first();
    const borderColor = await chip.evaluate(
      (el) => window.getComputedStyle(el).borderColor
    );
    expect(borderColor).not.toMatch(/rgb\(46,\s*184,\s*115\)/);
  });
});

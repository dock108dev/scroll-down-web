/**
 * E2E tests for source attribution on game detail pages.
 * ISSUE-033: Book logos in odds table headers; data source footer on game detail.
 */
import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game detail source attribution @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("game detail page shows data attribution footer", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const attribution = authedPage.locator("[data-testid='game-data-attribution']");
    await expect(attribution).toBeVisible();
    const text = await attribution.textContent();
    expect(text).toMatch(/Game data provided by/i);
  });

  test("attribution footer not present on home page", async ({ authedPage }) => {
    const attribution = authedPage.locator("[data-testid='game-data-attribution']");
    await expect(attribution).toHaveCount(0);
  });

  test("odds table shows book logos in column headers", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section for this game"); return; }

    // Book logo images should appear in the odds table header
    const bookLogos = oddsSection.locator("table thead img");
    const count = await bookLogos.count();
    expect(count).toBeGreaterThan(0);
  });

  test("book logos in odds table use local /books/ assets only", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section for this game"); return; }

    const bookLogos = oddsSection.locator("table thead img");
    const count = await bookLogos.count();
    if (count === 0) { test.skip(true, "No book logos found"); return; }

    for (let i = 0; i < count; i++) {
      const src = await bookLogos.nth(i).getAttribute("src");
      expect(src).toMatch(/^\/books\//);
    }
  });
});

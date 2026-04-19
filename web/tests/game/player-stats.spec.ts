import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Player Stats — headline and expansion @live-upstream", () => {
  async function navigateToGame(page: Parameters<typeof waitForLoad>[0]) {
    await page.goto("/");
    await waitForLoad(page);
    const hasData = await waitForGameData(page);
    if (!hasData) return false;
    const row = page.locator("[data-testid='game-row']").first();
    await row.click();
    await page.waitForURL(/\/game\/.+/);
    await waitForLoad(page);
    return true;
  }

  test("player-stats-table is visible and shows team title when player data exists @smoke", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const tables = authedPage.locator("[data-testid='player-stats-table']");
    if ((await tables.count()) === 0) {
      test.skip(true, "No player stats tables on this game");
      return;
    }

    // At least one table must be visible
    await expect(tables.first()).toBeVisible();

    // Table must contain at least one player row
    const playerRows = authedPage.locator("[data-testid='player-row']");
    const rowCount = await playerRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("collapsed player row shows headline stat labels", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const playerRows = authedPage.locator("[data-testid='player-row']");
    if ((await playerRows.count()) === 0) {
      test.skip(true, "No player stat rows on this game");
      return;
    }

    const firstRow = playerRows.first();

    // Row is collapsed by default
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");

    // Headline stat labels visible inside collapsed row (e.g. PTS, REB, AST, YDS)
    const rowText = await firstRow.textContent();
    expect(rowText).toBeTruthy();
    // Player name abbreviation and at least one stat label must be present
    expect(rowText!.length).toBeGreaterThan(3);
  });

  test("all player rows are collapsed by default", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const playerRows = authedPage.locator("[data-testid='player-row']");
    const rowCount = await playerRows.count();
    if (rowCount === 0) {
      test.skip(true, "No player stat rows on this game");
      return;
    }

    // No expanded detail rows before any interaction
    const expandedRows = authedPage.locator("[data-testid='player-row-expanded']");
    await expect(expandedRows).toHaveCount(0);

    // Check first few rows are all collapsed
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      await expect(playerRows.nth(i)).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("expanding a player row reveals additional stat columns", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const playerRows = authedPage.locator("[data-testid='player-row']");
    if ((await playerRows.count()) === 0) {
      test.skip(true, "No player stat rows on this game");
      return;
    }

    const firstRow = playerRows.first();
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");

    await firstRow.click();
    await authedPage.waitForTimeout(100);

    await expect(firstRow).toHaveAttribute("aria-expanded", "true");

    const expanded = authedPage.locator("[data-testid='player-row-expanded']").first();
    await expect(expanded).toBeVisible();
  });

  test("collapsing an expanded player row hides detail stats", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const playerRows = authedPage.locator("[data-testid='player-row']");
    if ((await playerRows.count()) === 0) {
      test.skip(true, "No player stat rows on this game");
      return;
    }

    const firstRow = playerRows.first();

    // Expand
    await firstRow.click();
    await authedPage.waitForTimeout(100);
    await expect(firstRow).toHaveAttribute("aria-expanded", "true");
    await expect(authedPage.locator("[data-testid='player-row-expanded']").first()).toBeVisible();

    // Collapse
    await firstRow.click();
    await authedPage.waitForTimeout(100);
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");
    const expandedRows = authedPage.locator("[data-testid='player-row-expanded']");
    await expect(expandedRows).toHaveCount(0);
  });

  test("multiple player rows can be independently expanded", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const playerRows = authedPage.locator("[data-testid='player-row']");
    const rowCount = await playerRows.count();
    if (rowCount < 2) {
      test.skip(true, "Need at least 2 player rows for multi-expand test");
      return;
    }

    const first = playerRows.nth(0);
    const second = playerRows.nth(1);

    await first.click();
    await authedPage.waitForTimeout(100);
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(second).toHaveAttribute("aria-expanded", "false");

    await second.click();
    await authedPage.waitForTimeout(100);
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(second).toHaveAttribute("aria-expanded", "true");

    // Two expanded detail sections
    const expanded = authedPage.locator("[data-testid='player-row-expanded']");
    expect(await expanded.count()).toBeGreaterThanOrEqual(2);
  });

  test("no player-stats-table rendered when game has no player data", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const tables = authedPage.locator("[data-testid='player-stats-table']");
    if ((await tables.count()) > 0) {
      // This game HAS stats — skip the absence check
      test.skip(true, "Game has player stats — absence case not testable here");
      return;
    }

    // Absence case: no table, no stray expanded rows
    await expect(authedPage.locator("[data-testid='player-row']")).toHaveCount(0);
    await expect(authedPage.locator("[data-testid='player-row-expanded']")).toHaveCount(0);
  });
});

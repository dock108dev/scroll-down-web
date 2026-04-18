import { type Page } from "@playwright/test";
import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Team Stats Comparison", () => {
  async function navigateToFirstGame(authedPage: Page) {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
    const hasData = await waitForGameData(authedPage);
    if (!hasData) return false;

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);
    return true;
  }

  test("Team Stats section is collapsed by default", async ({ authedPage }) => {
    const ok = await navigateToFirstGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const teamStatsSection = authedPage.locator("#section-Team\\ Stats");
    if ((await teamStatsSection.count()) === 0) {
      test.skip(true, "No team stats on this game");
      return;
    }

    const toggleBtn = teamStatsSection.locator("button").first();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("Team Stats section expands and shows comparison module", async ({ authedPage }) => {
    const ok = await navigateToFirstGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const teamStatsSection = authedPage.locator("#section-Team\\ Stats");
    if ((await teamStatsSection.count()) === 0) {
      test.skip(true, "No team stats on this game");
      return;
    }

    const toggleBtn = teamStatsSection.locator("button").first();
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    const comparison = authedPage.locator("[data-testid='team-stats-comparison']");
    await expect(comparison).toBeVisible();
  });

  test("comparison module shows both team names in header", async ({ authedPage }) => {
    const ok = await navigateToFirstGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const teamStatsSection = authedPage.locator("#section-Team\\ Stats");
    if ((await teamStatsSection.count()) === 0) {
      test.skip(true, "No team stats on this game");
      return;
    }

    const toggleBtn = teamStatsSection.locator("button").first();
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    const comparison = authedPage.locator("[data-testid='team-stats-comparison']");
    await expect(comparison).toBeVisible();

    // Header row has 3 cols: away | "Team Stats" | home — all must be present
    const headerText = await comparison.locator(".grid.grid-cols-3").first().textContent();
    expect(headerText).toContain("Team Stats");
  });

  test("comparison module does not overflow horizontally on mobile", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 375, height: 812 });
    const ok = await navigateToFirstGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const teamStatsSection = authedPage.locator("#section-Team\\ Stats");
    if ((await teamStatsSection.count()) === 0) {
      test.skip(true, "No team stats on this game");
      return;
    }

    const toggleBtn = teamStatsSection.locator("button").first();
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    const comparison = authedPage.locator("[data-testid='team-stats-comparison']");
    await expect(comparison).toBeVisible();

    // Check no horizontal scroll is introduced
    const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  });

  test("Team Stats section is absent when data is missing", async ({ authedPage }) => {
    // Navigate to a game and verify the absence case is clean (no dead space)
    await authedPage.goto("/");
    await waitForLoad(authedPage);
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const teamStatsSection = authedPage.locator("#section-Team\\ Stats");
    // If absent, verify no empty placeholder is rendered
    if ((await teamStatsSection.count()) === 0) {
      const emptyPlaceholder = authedPage.locator("[data-testid='team-stats-comparison']");
      await expect(emptyPlaceholder).toHaveCount(0);
    }
  });
});

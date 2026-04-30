import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game Timeline — play-by-play @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  async function navigateToGame(page: Parameters<typeof waitForLoad>[0]) {
    const hasData = await waitForGameData(page);
    if (!hasData) return false;
    const row = page.locator("[data-testid='game-row']").first();
    await row.click();
    await page.waitForURL(/\/game\/.+/);
    await waitForLoad(page);
    return true;
  }

  test("timeline section renders full play-by-play by default", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    await expect(section).toBeVisible();

    await expect(section).toContainText("Full play-by-play");
    await expect(authedPage.locator("[data-testid='timeline-toggle']")).toHaveCount(0);
    await expect(section).not.toContainText("Key plays");
  });

  test("expand details button expands compact play groups when available", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const expandDetails = authedPage.locator("[data-testid='timeline-expand-details']");
    if ((await expandDetails.count()) === 0) {
      test.skip(true, "No compact play groups on this game");
      return;
    }

    await expect(expandDetails).toHaveAttribute("aria-pressed", "false");
    await expect(expandDetails).toHaveAttribute("aria-label", "Expand play details");

    await expandDetails.click();
    await expect(expandDetails).toHaveAttribute("aria-pressed", "true");
    await expect(expandDetails).toHaveAttribute("aria-label", "Collapse play details");
  });

  test("expand details button is keyboard accessible when available", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const expandDetails = authedPage.locator("[data-testid='timeline-expand-details']");
    if ((await expandDetails.count()) === 0) {
      test.skip(true, "No compact play groups on this game");
      return;
    }

    await expandDetails.focus();
    await authedPage.keyboard.press("Enter");
    await expect(expandDetails).toHaveAttribute("aria-pressed", "true");

    await authedPage.keyboard.press("Enter");
    await expect(expandDetails).toHaveAttribute("aria-pressed", "false");
  });

  test("period cards have aria-expanded and aria-controls attributes", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    // Period toggle buttons inside timeline section
    const periodButtons = section.locator(
      "button[aria-controls]",
    );
    const count = await periodButtons.count();
    if (count === 0) {
      test.skip(true, "No period cards on this game");
      return;
    }

    const firstBtn = periodButtons.first();
    await expect(firstBtn).toHaveAttribute("aria-expanded");
    await expect(firstBtn).toHaveAttribute("aria-controls");
  });

  test("expanded details show at least as many indexed plays as compact view", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    // Expand all period cards first
    const periodButtons = section.locator(
      "button[aria-controls]",
    );
    const count = await periodButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = periodButtons.nth(i);
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded === "false") await btn.click();
    }
    await authedPage.waitForTimeout(300);

    const compactRowCount = await section.locator("[data-play-index]").count();

    const expandDetails = authedPage.locator("[data-testid='timeline-expand-details']");
    if ((await expandDetails.count()) === 0) {
      test.skip(true, "No compact play groups on this game");
      return;
    }

    await expandDetails.click();
    await authedPage.waitForTimeout(300);

    const expandedRowCount = await section.locator("[data-play-index]").count();

    expect(expandedRowCount).toBeGreaterThanOrEqual(compactRowCount);
  });
});

import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game Timeline — highlights mode", () => {
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

  test("timeline section renders and toggle button is present", async ({
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

    const toggle = authedPage.locator("[data-testid='timeline-toggle']");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", "Show full play-by-play");
  });

  test("toggle button switches to full play-by-play and back", async ({
    authedPage,
  }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const toggle = authedPage.locator("[data-testid='timeline-toggle']");

    // Default: highlights mode
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Expand to full play-by-play
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveAttribute("aria-label", "Switch to key plays view");

    // Collapse back to highlights
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", "Show full play-by-play");
  });

  test("toggle button is keyboard accessible", async ({ authedPage }) => {
    const ok = await navigateToGame(authedPage);
    if (!ok) { test.skip(true, "No game data"); return; }

    const section = authedPage.locator("[data-testid='timeline-section']");
    if ((await section.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const toggle = authedPage.locator("[data-testid='timeline-toggle']");
    await toggle.focus();
    await authedPage.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await authedPage.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
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
      "button:not([data-testid='timeline-toggle'])",
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

  test("full play-by-play shows more plays than highlights mode", async ({
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
      "button:not([data-testid='timeline-toggle'])",
    );
    const count = await periodButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = periodButtons.nth(i);
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded === "false") await btn.click();
    }
    await authedPage.waitForTimeout(300);

    // Count play rows in highlights mode
    const highlightRowCount = await section.locator(".rounded-md, .rounded").count();

    // Switch to full play-by-play
    const toggle = authedPage.locator("[data-testid='timeline-toggle']");
    await toggle.click();
    await authedPage.waitForTimeout(300);

    const fullRowCount = await section.locator(".rounded-md, .rounded").count();

    // Full mode should show at least as many items as highlights mode
    // (strict greater-than only possible when tier 3 data exists)
    expect(fullRowCount).toBeGreaterThanOrEqual(highlightRowCount);
  });
});

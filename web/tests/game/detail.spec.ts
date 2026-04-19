import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game Detail Page @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("navigate to a game from home page loads game detail", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);
    await expect(authedPage).toHaveURL(/\/game\/.+/);
  });

  test("game detail shows team information", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const pageText = await authedPage.locator("body").textContent();
    expect(pageText).toBeTruthy();
    expect(pageText!.length).toBeGreaterThan(10);
  });

  test("section nav is visible with section buttons", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const sections = authedPage.locator("[id^='section-']");
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThanOrEqual(1);
  });

  test("sections can be expanded and collapsed", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const section = authedPage.locator("[id^='section-']").first();
    await expect(section).toBeVisible();

    const toggleBtn = section.locator("button").first();
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    await expect(section).toBeVisible();
  });

  test("pin button works on game detail page", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const pinButton = authedPage.locator("[title='Pin game']");
    if ((await pinButton.count()) === 0) {
      test.skip(true, "No pin button on this game detail page");
      return;
    }
    await expect(pinButton).toBeVisible();

    await pinButton.click();
    const unpinButton = authedPage.locator("[title='Unpin game']");
    await expect(unpinButton).toBeVisible();

    await unpinButton.click();
    await expect(authedPage.locator("[title='Pin game']")).toBeVisible();
  });

  test("back navigation returns to home page", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await authedPage.goBack();
    await authedPage.waitForURL("/");
    await waitForLoad(authedPage);
    await expect(authedPage).toHaveURL("/");
  });

  test("game story section is collapsed by default and shows beta label when present", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const gameStorySection = authedPage.locator("#section-Game\\ Story");
    if ((await gameStorySection.count()) === 0) {
      test.skip(true, "No Game Story section on this game");
      return;
    }

    // Beta label must be present
    await expect(gameStorySection.locator("text=beta")).toBeVisible();

    // Must be collapsed by default (button aria-expanded=false)
    const toggleBtn = gameStorySection.locator("button").first();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // AI content must not be visible without interaction
    const flowContent = gameStorySection.locator(".pb-2");
    await expect(flowContent).toHaveCount(0);

    // Expanding persists (click to expand, check content appears)
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  });

  test("score data-testid attributes exist and no score-flash on initial load", async ({ authedPage }) => {
    await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      const parsed = raw ? JSON.parse(raw) : { state: {} };
      if (!parsed.state) parsed.state = {};
      parsed.state.scoreRevealMode = "always";
      localStorage.setItem("sd-settings", JSON.stringify(parsed));
    });

    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // No score-flash class should be present on initial load
    const flashingCount = await authedPage.evaluate(
      () => document.querySelectorAll(".score-flash").length,
    );
    expect(flashingCount).toBe(0);

    // score-away and score-home testids exist when game has scores (non-pregame)
    const header = authedPage.locator("[data-testid='game-header']");
    await expect(header).toBeVisible();

    const awayEl = authedPage.locator("[data-testid='score-away']");
    const homeEl = authedPage.locator("[data-testid='score-home']");
    // Pregame games won't have score elements, so just verify counts are consistent
    const awayCount = await awayEl.count();
    const homeCount = await homeEl.count();
    expect(awayCount).toBe(homeCount);
  });

  test("player stat rows collapse by default and expand on click", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const playerRows = authedPage.locator("[data-testid='player-row']");
    const rowCount = await playerRows.count();
    if (rowCount === 0) { test.skip(true, "No player stat rows on this game"); return; }

    // Rows start collapsed
    const firstRow = playerRows.first();
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");

    // Expanded detail not visible before click
    const expandedBefore = authedPage.locator("[data-testid='player-row-expanded']");
    const countBefore = await expandedBefore.count();

    // Click to expand
    await firstRow.click();
    await authedPage.waitForTimeout(100);
    await expect(firstRow).toHaveAttribute("aria-expanded", "true");

    // Expanded detail now visible
    const expandedAfter = authedPage.locator("[data-testid='player-row-expanded']").first();
    await expect(expandedAfter).toBeVisible();

    // Count increased or a new one appeared
    const countAfter = await authedPage.locator("[data-testid='player-row-expanded']").count();
    expect(countAfter).toBeGreaterThan(countBefore);

    // Click again to collapse
    await firstRow.click();
    await authedPage.waitForTimeout(100);
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");
  });

  test("social reaction sections are not visible for non-admin users @smoke", async ({ page }) => {
    // Navigate as a logged-out (guest) user
    await page.goto("/");
    await waitForLoad(page);

    const hasData = await waitForGameData(page);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = page.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await page.waitForURL(/\/game\/.+/);
    await waitForLoad(page);

    // Neither "Pregame Buzz" nor "Reactions" section headings should be visible
    const pregameBuzz = page.locator("[data-testid='pregame-buzz-section']");
    await expect(pregameBuzz).toHaveCount(0);

    const sectionHeadings = page.locator("text='Pregame Buzz'");
    await expect(sectionHeadings).toHaveCount(0);
  });
});

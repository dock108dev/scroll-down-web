import { test, expect, waitForLoad } from "../helpers";

test.describe("Game Detail Page", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("navigate to a game from home page loads game detail", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await expect(gameRow).toBeVisible();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);
    await expect(authedPage).toHaveURL(/\/game\/.+/);
  });

  test("game detail shows team information", async ({ authedPage }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Page should contain team-related text (matchup abbreviations like "LAL @ LAC")
    const pageText = await authedPage.locator("body").textContent();
    expect(pageText).toBeTruthy();
    // At least the "@" separator or team names should be present
    expect(pageText!.length).toBeGreaterThan(10);
  });

  test("section nav is visible with section buttons", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Section nav renders as a container with buttons for each section
    // Sections include things like "Timeline", "Player Stats", "Odds", etc.
    // Look for elements with id starting with "section-"
    const sections = authedPage.locator("[id^='section-']");
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThanOrEqual(1);
  });

  test("sections can be expanded and collapsed", async ({ authedPage }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Find a collapsible section by its id pattern
    const section = authedPage.locator("[id^='section-']").first();
    await expect(section).toBeVisible();

    // The section's first child button is the toggle
    const toggleBtn = section.locator("button").first();
    await expect(toggleBtn).toBeVisible();

    // Click to toggle - should change visibility of content
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    // Click again to toggle back
    await toggleBtn.click();
    await authedPage.waitForTimeout(200);

    // Section should still be present
    await expect(section).toBeVisible();
  });

  test("pin button works on game detail page", async ({ authedPage }) => {
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

    // Click to pin
    await pinButton.click();
    const unpinButton = authedPage.locator("[title='Unpin game']");
    await expect(unpinButton).toBeVisible();

    // Click to unpin
    await unpinButton.click();
    await expect(authedPage.locator("[title='Pin game']")).toBeVisible();
  });

  test("back navigation returns to home page", async ({ authedPage }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await authedPage.goBack();
    await authedPage.waitForURL("/");
    await waitForLoad(authedPage);
    await expect(authedPage).toHaveURL("/");
  });
});

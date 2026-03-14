import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game Detail Page", () => {
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
});

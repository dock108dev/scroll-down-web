import { test, expect, waitForLoad } from "../helpers";

test.describe("Game Detail Reading Position", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("scrolling on game detail page saves reading position to localStorage", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Scroll down the page to trigger position saving
    await authedPage.evaluate(() => window.scrollBy(0, 600));
    // Allow time for the scroll handler to persist position
    await authedPage.waitForTimeout(1000);

    const positionData = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionData).not.toBeNull();
  });

  test("reading position data exists in localStorage after scrolling", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Scroll to trigger position saving
    await authedPage.evaluate(() => window.scrollBy(0, 800));
    await authedPage.waitForTimeout(1000);

    const positionData = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionData).not.toBeNull();

    const parsed = JSON.parse(positionData!);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe("object");
  });

  test("navigate away and back preserves reading position data", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    const gameUrl = authedPage.url();
    await waitForLoad(authedPage);

    // Scroll to save position
    await authedPage.evaluate(() => window.scrollBy(0, 800));
    await authedPage.waitForTimeout(1000);

    const positionBefore = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionBefore).not.toBeNull();

    // Navigate away
    await authedPage.goBack();
    await authedPage.waitForURL("/");
    await waitForLoad(authedPage);

    // Navigate back to the same game
    await authedPage.goto(gameUrl);
    await waitForLoad(authedPage);

    const positionAfter = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionAfter).not.toBeNull();
    expect(positionAfter).toBe(positionBefore);
  });

  test("localStorage key sd-reading-position contains game-specific data", async ({
    authedPage,
  }) => {
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Scroll enough to trigger position save
    await authedPage.evaluate(() => window.scrollBy(0, 1000));
    await authedPage.waitForTimeout(1000);

    const positionData = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionData).not.toBeNull();

    const parsed = JSON.parse(positionData!);
    const dataStr = JSON.stringify(parsed);
    expect(dataStr.length).toBeGreaterThan(2); // More than just "{}"
  });
});

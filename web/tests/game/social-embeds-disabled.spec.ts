import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Social Embeds Disabled @smoke", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("game detail page has no social embed elements when flag is disabled", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data");
      return;
    }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await expect(authedPage.locator("[data-testid='page-game-detail']")).toBeVisible();

    // No social section should be present
    await expect(authedPage.locator("[data-testid='social-section']")).toHaveCount(0);

    // No social embed cards should be present
    await expect(authedPage.locator("[data-testid='social-embed-card']")).toHaveCount(0);

    // No pregame buzz section should be present
    await expect(authedPage.locator("[data-testid='pregame-buzz-section']")).toHaveCount(0);
  });

  test("disabled indicator is visible when social embeds are off", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data");
      return;
    }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await expect(authedPage.locator("[data-testid='page-game-detail']")).toBeVisible();
    await expect(
      authedPage.locator("[data-testid='social-embeds-disabled-indicator']"),
    ).toBeVisible();
  });
});

import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Home page – pinning", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await authedPage.evaluate(() =>
      localStorage.removeItem("sd-pinned-games"),
    );
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  test("pin icon is visible on game rows", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const pinBtn = authedPage.getByTitle("Pin game").first();
    await expect(pinBtn).toBeVisible();
  });

  test("clicking pin icon toggles to Unpin", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const pinBtn = authedPage.getByTitle("Pin game").first();
    await pinBtn.click();

    const unpinBtn = authedPage.getByTitle("Unpin game").first();
    await expect(unpinBtn).toBeVisible({ timeout: 3000 });
  });

  test("PinnedBar appears in header after pinning", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible({ timeout: 3000 });
    const chips = pinnedBar.locator("[data-testid='pinned-chip']");
    expect(await chips.count()).toBeGreaterThan(0);
  });

  test("clicking X on pinned chip removes it", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible();

    const chip = pinnedBar.locator("[data-testid='pinned-chip']").first();
    const removeBtn = chip.locator('span[role="button"]').last();
    await removeBtn.click();
    await authedPage.waitForTimeout(300);

    await expect(pinnedBar).not.toBeVisible();
  });

  test("pins persist after page reload", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    await authedPage.reload();
    await waitForLoad(authedPage);

    const pinnedBar = authedPage.locator("[data-testid='pinned-bar']");
    await expect(pinnedBar).toBeVisible({ timeout: 3000 });

    const unpinBtn = authedPage.getByTitle("Unpin game").first();
    await expect(unpinBtn).toBeVisible();
  });

  test("pin state stored in localStorage under sd-pinned-games", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    await authedPage.getByTitle("Pin game").first().click();
    await authedPage.waitForTimeout(300);

    const stored = await authedPage.evaluate(() =>
      localStorage.getItem("sd-pinned-games"),
    );
    expect(stored).toBeTruthy();
  });

  test("multiple games can be pinned", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const pinButtons = authedPage.getByTitle("Pin game");
    const count = Math.min(await pinButtons.count(), 3);

    for (let i = 0; i < count; i++) {
      await authedPage.getByTitle("Pin game").first().click();
      await authedPage.waitForTimeout(300);
    }

    const chips = authedPage.locator(
      "[data-testid='pinned-bar'] [data-testid='pinned-chip']",
    );
    expect(await chips.count()).toBe(count);
  });
});

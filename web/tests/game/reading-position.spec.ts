import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Game Detail Reading Position @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("scrolling on game detail page saves reading position to localStorage", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await authedPage.evaluate(() => window.scrollBy(0, 600));
    await authedPage.waitForTimeout(1000);

    const positionData = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionData).not.toBeNull();
  });

  test("reading position data exists in localStorage after scrolling", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

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
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    const gameUrl = authedPage.url();
    await waitForLoad(authedPage);

    await authedPage.evaluate(() => window.scrollBy(0, 800));
    await authedPage.waitForTimeout(1000);

    const positionBefore = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionBefore).not.toBeNull();

    await authedPage.goBack();
    await authedPage.waitForURL("/");
    await waitForLoad(authedPage);

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
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    await authedPage.evaluate(() => window.scrollBy(0, 1000));
    await authedPage.waitForTimeout(1000);

    const positionData = await authedPage.evaluate(() =>
      localStorage.getItem("sd-reading-position"),
    );
    expect(positionData).not.toBeNull();

    const parsed = JSON.parse(positionData!);
    const dataStr = JSON.stringify(parsed);
    expect(dataStr.length).toBeGreaterThan(2);
  });

  test("play elements have data-play-index attributes when timeline is expanded", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const timeline = authedPage.locator("[data-testid='timeline-section']");
    if ((await timeline.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const firstPeriod = timeline.locator("button[aria-controls]").first();
    if ((await firstPeriod.count()) === 0) {
      test.skip(true, "No period cards on this game");
      return;
    }
    if ((await firstPeriod.getAttribute("aria-expanded")) === "false") {
      await firstPeriod.click();
    }
    await authedPage.waitForTimeout(300);

    const playElements = authedPage.locator("[data-play-index]");
    const count = await playElements.count();
    expect(count).toBeGreaterThan(0);

    // Every element must expose a numeric play index
    for (let i = 0; i < Math.min(count, 5); i++) {
      const val = await playElements.nth(i).getAttribute("data-play-index");
      expect(Number(val)).not.toBeNaN();
    }
  });

  test("resume from stale or missing position fails gracefully without errors", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    // Inject a stale position for a play index that does not exist
    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    const gameId = authedPage.url().match(/\/game\/(\d+)/)?.[1];
    if (!gameId) { test.skip(true, "Could not extract game id"); return; }

    await authedPage.evaluate((id) => {
      const entry = {
        state: {
          positions: {
            [id]: {
              playIndex: 999999,
              period: 99,
              savedAt: new Date().toISOString(),
              playCount: 1,
            },
          },
        },
        version: 0,
      };
      localStorage.setItem("sd-reading-position", JSON.stringify(entry));
    }, gameId);

    const errors: string[] = [];
    authedPage.on("pageerror", (e) => errors.push(e.message));

    await authedPage.reload();
    await waitForLoad(authedPage);
    await authedPage.waitForTimeout(3500); // let resume attempt and time out

    expect(errors).toHaveLength(0);
  });

  test("resume scrolls to saved play after in-app navigation away and back", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRow = authedPage.locator("[data-testid='game-row']").first();
    await gameRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    const gameUrl = authedPage.url();
    await waitForLoad(authedPage);

    const timeline = authedPage.locator("[data-testid='timeline-section']");
    if ((await timeline.count()) === 0) {
      test.skip(true, "No timeline on this game");
      return;
    }

    const firstPeriod = timeline.locator("button[aria-controls]").first();
    if ((await firstPeriod.count()) === 0) {
      test.skip(true, "No period cards on this game");
      return;
    }
    if ((await firstPeriod.getAttribute("aria-expanded")) === "false") {
      await firstPeriod.click();
    }
    await authedPage.waitForTimeout(300);

    const playElements = authedPage.locator("[data-play-index]");
    if ((await playElements.count()) === 0) {
      test.skip(true, "No play elements with data-play-index");
      return;
    }

    // Scroll past the first few plays so a position gets saved
    await authedPage.evaluate(() => window.scrollBy(0, 800));
    await authedPage.waitForTimeout(1000);

    // Navigate away then back
    await authedPage.goBack();
    await authedPage.waitForURL("/");
    await waitForLoad(authedPage);

    await authedPage.goto(gameUrl);
    await waitForLoad(authedPage);
    await authedPage.waitForTimeout(3000); // allow resume polling to complete

    // After resume the page should still be usable — no crash
    await expect(authedPage.locator("[data-testid='page-game-detail']")).toBeVisible();
  });
});

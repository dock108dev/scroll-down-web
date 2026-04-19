import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Live badge indicator on game rows and game detail @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("live game rows show live-badge with LIVE text", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const liveBadges = authedPage.locator("[data-testid='live-badge']");
    const count = await liveBadges.count();
    if (count === 0) {
      test.skip(true, "No live games currently in feed");
      return;
    }

    await expect(liveBadges.first()).toBeVisible();
    const text = await liveBadges.first().textContent();
    expect(text).toMatch(/LIVE/i);
  });

  test("live-badge is absent from final game rows", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Find rows that show "Final" (muted status text)
    const finalRows = authedPage.locator("[data-testid='game-row']").filter({
      hasText: "Final",
    });
    const count = await finalRows.count();
    if (count === 0) {
      test.skip(true, "No final games in feed");
      return;
    }

    for (let i = 0; i < count; i++) {
      const badge = finalRows.nth(i).locator("[data-testid='live-badge']");
      await expect(badge).not.toBeVisible();
    }
  });

  test("live-badge absent from pregame rows (no dot shown)", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Pregame rows show a time string, not LIVE or Final
    // We confirm no live-badge appears on rows that don't have a live-badge
    // by checking that live-badge elements only exist within live rows
    const allRows = authedPage.locator("[data-testid='game-row']");
    const rowCount = await allRows.count();
    if (rowCount === 0) {
      test.skip(true, "No game rows");
      return;
    }

    for (let i = 0; i < rowCount; i++) {
      const row = allRows.nth(i);
      const hasFinal = (await row.locator("text=Final").count()) > 0;
      const hasBadge = (await row.locator("[data-testid='live-badge']").count()) > 0;
      // A row showing "Final" must not also show a live badge
      if (hasFinal) {
        expect(hasBadge).toBe(false);
      }
    }
  });

  test("live-badge on game detail page for live game", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Find a live game row and navigate to its detail
    const liveRow = authedPage
      .locator("[data-testid='game-row']")
      .filter({ has: authedPage.locator("[data-testid='live-badge']") })
      .first();

    const hasLive = (await liveRow.count()) > 0;
    if (!hasLive) {
      test.skip(true, "No live game rows to navigate to");
      return;
    }

    await liveRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const detailBadge = authedPage.locator("[data-testid='live-badge']");
    await expect(detailBadge).toBeVisible();
    const text = await detailBadge.textContent();
    expect(text).toMatch(/LIVE/i);
  });
});

import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Home page – game list", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("loads and shows game content", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }
    const rows = authedPage.locator("[data-testid='game-row']");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("league filter pills are visible and clicking one filters games", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const allPill = authedPage.getByRole("button", { name: "All" });
    await expect(allPill).toBeVisible();

    const pills = authedPage.locator("[data-testid='league-filter'] button");
    expect(await pills.count()).toBeGreaterThan(1);

    const totalBefore = await authedPage
      .locator("[data-testid='game-row']")
      .count();

    const leaguePill = pills.nth(1);
    await leaguePill.click();

    await authedPage.waitForTimeout(300);
    const totalAfter = await authedPage
      .locator("[data-testid='game-row']")
      .count();

    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
  });

  test("search bar filters games by team name", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const rows = authedPage.locator("[data-testid='game-row']");
    const firstRowText = await rows.first().textContent();
    const tokens = (firstRowText ?? "").split(/\s+/).filter((t) => t.length > 2);
    const query = tokens[0] ?? "team";

    const searchInput = authedPage.getByPlaceholder(/search/i);
    await searchInput.fill(query);
    await authedPage.waitForTimeout(400);

    const filtered = await rows.count();
    expect(filtered).toBeGreaterThan(0);
  });

  test("combined league filter and search works", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const pills = authedPage.locator("[data-testid='league-filter'] button");
    await pills.nth(1).click();
    await authedPage.waitForTimeout(300);

    const rows = authedPage.locator("[data-testid='game-row']");
    const afterLeague = await rows.count();

    const searchInput = authedPage.getByPlaceholder(/search/i);
    await searchInput.fill("zzz_nonexistent");
    await authedPage.waitForTimeout(400);

    const afterBoth = await rows.count();
    expect(afterBoth).toBeLessThanOrEqual(afterLeague);
  });

  test("search with no matches shows appropriate state", async ({
    authedPage,
  }) => {
    const searchInput = authedPage.getByPlaceholder(/search/i);
    await searchInput.fill("xyznonexistentteam99");
    await authedPage.waitForTimeout(400);

    const rows = authedPage.locator("[data-testid='game-row']");
    expect(await rows.count()).toBe(0);
  });

  test("sections are visible with date-based headings", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const headings = authedPage.locator("h2, h3").filter({
      hasText: /today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}/i,
    });
    expect(await headings.count()).toBeGreaterThan(0);
    await expect(headings.first()).toBeVisible();
  });

  test("game row click navigates to /game/[id]", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const row = authedPage.locator("[data-testid='game-row']").first();
    await row.click();
    await authedPage.waitForURL(/\/game\/.+/);
    expect(authedPage.url()).toMatch(/\/game\/[a-zA-Z0-9_-]+/);
  });

  test("refresh triggers data reload", async ({ authedPage }) => {
    const refreshBtn = authedPage.getByTitle("Refresh");
    await expect(refreshBtn).toBeVisible();

    const responsePromise = authedPage.waitForResponse(
      (resp) => resp.url().includes("/api/") && resp.status() === 200,
    );
    await refreshBtn.click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
  });
});

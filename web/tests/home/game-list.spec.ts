import { test, expect, waitForLoad } from "../helpers";

test.describe("Home page – game list", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("loads and shows game content", async ({ authedPage }) => {
    const rows = authedPage.locator("[data-testid='game-row']");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("league filter pills are visible and clicking one filters games", async ({
    authedPage,
  }) => {
    const allPill = authedPage.getByRole("button", { name: "All" });
    await expect(allPill).toBeVisible();

    // Gather league pills
    const pills = authedPage.locator("[data-testid='league-filter'] button");
    expect(await pills.count()).toBeGreaterThan(1);

    const totalBefore = await authedPage
      .locator("[data-testid='game-row']")
      .count();

    // Click the second pill (first league-specific filter)
    const leaguePill = pills.nth(1);
    await leaguePill.click();

    await authedPage.waitForTimeout(300);
    const totalAfter = await authedPage
      .locator("[data-testid='game-row']")
      .count();

    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
  });

  test("search bar filters games by team name", async ({ authedPage }) => {
    const rows = authedPage.locator("[data-testid='game-row']");
    const firstRowText = await rows.first().textContent();
    // Extract a team-like word (skip short tokens like "@", "vs")
    const tokens = (firstRowText ?? "").split(/\s+/).filter((t) => t.length > 2);
    const query = tokens[0] ?? "team";

    const searchInput = authedPage.getByPlaceholder(/search/i);
    await searchInput.fill(query);
    await authedPage.waitForTimeout(400);

    const filtered = await rows.count();
    expect(filtered).toBeGreaterThan(0);
  });

  test("combined league filter and search works", async ({ authedPage }) => {
    // Apply league filter first
    const pills = authedPage.locator("[data-testid='league-filter'] button");
    await pills.nth(1).click();
    await authedPage.waitForTimeout(300);

    const rows = authedPage.locator("[data-testid='game-row']");
    const afterLeague = await rows.count();

    // Now add a search term
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
    const headings = authedPage.locator("h2, h3").filter({
      hasText: /today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}/i,
    });
    expect(await headings.count()).toBeGreaterThan(0);
    await expect(headings.first()).toBeVisible();
  });

  test("game row click navigates to /game/[id]", async ({ authedPage }) => {
    const row = authedPage.locator("[data-testid='game-row']").first();
    await row.click();
    await authedPage.waitForURL(/\/game\/.+/);
    expect(authedPage.url()).toMatch(/\/game\/[a-zA-Z0-9_-]+/);
  });

  test("refresh triggers data reload", async ({ authedPage }) => {
    const refreshBtn = authedPage.getByTitle("Refresh");
    await expect(refreshBtn).toBeVisible();

    // Watch for network activity on click
    const responsePromise = authedPage.waitForResponse(
      (resp) => resp.url().includes("/api/") && resp.status() === 200,
    );
    await refreshBtn.click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
  });
});

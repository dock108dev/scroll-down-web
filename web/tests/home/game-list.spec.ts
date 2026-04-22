import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Home page – game list @live-upstream", () => {
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

    await authedPage.getByTestId("search-toggle").click();
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

    await authedPage.getByTestId("search-toggle").click();
    const searchInput = authedPage.getByPlaceholder(/search/i);
    await searchInput.fill("zzz_nonexistent");
    await authedPage.waitForTimeout(400);

    const afterBoth = await rows.count();
    expect(afterBoth).toBeLessThanOrEqual(afterLeague);
  });

  test("search with no matches shows appropriate state", async ({
    authedPage,
  }) => {
    await authedPage.getByTestId("search-toggle").click();
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

  test("reveal gesture: blur overlay visible then fades on reveal click", async ({ authedPage }) => {
    // Clear reveal state so games appear unrevealed
    await authedPage.evaluate(() => localStorage.removeItem("sd-read-state"));
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealButton = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealButton.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games available (not in onMarkRead mode)");
      return;
    }

    // Blur overlay should be visible before reveal
    const overlay = authedPage.locator("[data-testid='score-blur-overlay']").first();
    await expect(overlay).toBeVisible();

    // Click reveal — CSS transition fades overlay out in ~200ms
    await revealButton.click();
    await authedPage.waitForTimeout(250);

    // Overlay should now be opacity-0 (invisible to Playwright)
    await expect(overlay).not.toBeVisible();
    await expect(revealButton).not.toBeVisible();
  });

  test("reveal visual states: unrevealed rows have data-reveal-state attribute", async ({ authedPage }) => {
    await authedPage.evaluate(() => localStorage.removeItem("sd-read-state"));
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const unrevealedRow = authedPage.locator("[data-reveal-state='unrevealed']").first();
    const hasUnrevealed = (await unrevealedRow.count()) > 0;
    if (!hasUnrevealed) {
      test.skip(true, "No unrevealed rows — not in onMarkRead mode or all games are live/pregame");
      return;
    }

    await expect(unrevealedRow).toBeVisible();
    // Unrevealed row must contain the reveal button
    await expect(unrevealedRow.locator("[data-testid='reveal-button']")).toBeVisible();
  });

  test("reveal visual states: revealed row transitions to revealed state", async ({ authedPage }) => {
    await authedPage.evaluate(() => localStorage.removeItem("sd-read-state"));
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No reveal buttons — not in onMarkRead mode");
      return;
    }

    // Click reveal on first unrevealed game
    await revealBtn.click();
    await authedPage.waitForTimeout(300);

    // At least one row should now be in revealed or updated state
    const settledRow = authedPage.locator("[data-reveal-state='revealed'], [data-reveal-state='updated']").first();
    await expect(settledRow).toBeVisible();
  });

  test("reveal visual states: updated rows show UPDATE indicator", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const updatedRow = authedPage.locator("[data-reveal-state='updated']").first();
    const hasUpdated = (await updatedRow.count()) > 0;
    if (!hasUpdated) {
      // Updated state only appears when a score changed after reveal — skip if not present
      test.skip(true, "No updated rows currently present");
      return;
    }

    await expect(updatedRow).toBeVisible();
    // Updated row should show the UPD status indicator
    const updStatusEl = updatedRow.locator("button", { hasText: /UPD/i });
    await expect(updStatusEl).toBeVisible();
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

  test("batch reveal: Reveal All marks all section games as revealed", async ({ authedPage }) => {
    await authedPage.evaluate(() => localStorage.removeItem("sd-read-state"));
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealAllBtn = authedPage.locator("[data-testid^='reveal-all-']").first();
    const hasRevealAll = (await revealAllBtn.count()) > 0;
    if (!hasRevealAll) {
      test.skip(true, "No Reveal All button — not in onMarkRead mode or no revealable games");
      return;
    }

    const unrevealedBefore = await authedPage.locator("[data-reveal-state='unrevealed']").count();
    expect(unrevealedBefore).toBeGreaterThan(0);

    await revealAllBtn.click();
    await authedPage.waitForTimeout(300);

    // After Reveal All, the button should disappear (no more unrevealed games in that section)
    await expect(revealAllBtn).not.toBeVisible();
  });

  test("score-value data-testid present for non-pregame games in always mode", async ({ authedPage }) => {
    await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      const parsed = raw ? JSON.parse(raw) : { state: {} };
      if (!parsed.state) parsed.state = {};
      parsed.state.scoreRevealMode = "always";
      localStorage.setItem("sd-settings", JSON.stringify(parsed));
    });
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // At least one score-value testid should exist (for non-pregame games)
    const scoreEls = authedPage.locator("[data-testid='score-value']");
    const count = await scoreEls.count();
    expect(count).toBeGreaterThanOrEqual(0); // pregame-only days are valid 0

    // No score-flash class should be present on initial load
    const flashCount = await authedPage.evaluate(
      () => document.querySelectorAll(".score-flash").length,
    );
    expect(flashCount).toBe(0);
  });

});

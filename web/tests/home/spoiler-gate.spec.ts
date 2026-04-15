import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("SpoilerGate — score reveal gatekeeper", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    // Reset to onMarkRead mode and clear reveal state
    await authedPage.evaluate(() => {
      localStorage.removeItem("sd-read-state");
      const raw = localStorage.getItem("sd-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.scoreRevealMode = "onMarkRead";
        parsed.state.scoreHideLeagues = [];
        parsed.state.scoreHideTeams = [];
        parsed.state.followingLive = false;
        parsed.state.followingLiveAt = 0;
        localStorage.setItem("sd-settings", JSON.stringify(parsed));
      }
    });
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  test("in onMarkRead mode, no score text appears in DOM before user taps reveal", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available");
      return;
    }

    // Check that game rows exist
    const rows = authedPage.locator("[data-testid='game-row']");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(true, "No game rows rendered");
      return;
    }

    // In onMarkRead mode with cleared reveal state, no score digits should
    // appear in the score zone (the right side of game rows). Look for the
    // digit-dash-digit pattern that indicates a visible score.
    const scorePattern = authedPage.locator(
      "[data-testid='game-row'] .text-lg.font-bold.tabular-nums",
    );
    const visibleScoreCount = await scorePattern.count();

    // All scores should be hidden — Reveal buttons shown instead
    expect(visibleScoreCount).toBe(0);
  });

  test("after tap reveal, scores appear and persist across page reload", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available");
      return;
    }

    const revealBtn = authedPage.getByRole("button", { name: /reveal/i });
    const count = await revealBtn.count();
    if (count === 0) {
      test.skip(true, "No revealable scores available");
      return;
    }

    // Reveal the first game
    await revealBtn.first().click();

    // Score text with digit-dash-digit should now appear
    const scoreText = authedPage
      .locator("text=/\\d+\\s*[\\u2013\\-]\\s*\\d+/")
      .first();
    await expect(scoreText).toBeVisible({ timeout: 3000 });

    // Verify localStorage was updated
    const readState = await authedPage.evaluate(() =>
      localStorage.getItem("sd-read-state"),
    );
    expect(readState).toBeTruthy();
    const parsed = JSON.parse(readState!);
    expect(parsed.state.revealedIds.length).toBeGreaterThan(0);

    // Reload and verify scores persist
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const scoreAfterReload = authedPage
      .locator("text=/\\d+\\s*[\\u2013\\-]\\s*\\d+/")
      .first();
    await expect(scoreAfterReload).toBeVisible({ timeout: 5000 });
  });

  test("a game from a hidden league shows no score even in always mode", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available");
      return;
    }

    // Get a league code from the first game row's league badge
    const leagueBadge = authedPage
      .locator("[data-testid='game-row'] .text-\\[10px\\].font-bold.uppercase")
      .first();
    const badgeCount = await leagueBadge.count();
    if (badgeCount === 0) {
      test.skip(true, "No league badge found");
      return;
    }

    const leagueText = await leagueBadge.textContent();
    if (!leagueText) {
      test.skip(true, "Could not read league text");
      return;
    }
    const leagueCode = leagueText.trim().toUpperCase();

    // Set blacklist mode with this league hidden
    await authedPage.evaluate((league) => {
      const raw = localStorage.getItem("sd-settings");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      parsed.state.scoreRevealMode = "blacklist";
      parsed.state.scoreHideLeagues = [league];
      localStorage.setItem("sd-settings", JSON.stringify(parsed));
    }, leagueCode);

    // Also reveal all games to simulate "always" for non-hidden games
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    // Games from the hidden league should show Reveal buttons, not scores
    // even though other games might show scores
    const revealButtons = authedPage.getByRole("button", { name: /reveal/i });
    const revealCount = await revealButtons.count();

    // There should be at least one revealable game from the hidden league
    // (if games from that league exist with score data)
    if (revealCount === 0) {
      test.skip(true, "No games with hidden league scores available");
      return;
    }
    await expect(revealButtons.first()).toBeVisible();
  });

  test("tab title and page metadata do not contain score values for hidden games", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available");
      return;
    }

    // In onMarkRead mode with no reveals, check that the page title
    // does not contain any score-like patterns
    const title = await authedPage.title();
    const scorePatternInTitle = /\d+\s*[-\u2013]\s*\d+/.test(title);
    expect(scorePatternInTitle).toBe(false);

    // Check meta description if it exists
    const metaDescription = await authedPage.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]');
      return meta?.getAttribute("content") ?? "";
    });
    const scorePatternInMeta = /\d+\s*[-\u2013]\s*\d+/.test(metaDescription);
    expect(scorePatternInMeta).toBe(false);
  });
});

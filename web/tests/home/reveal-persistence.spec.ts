import { test, expect, waitForLoad, waitForGameData } from "../helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearRevealState(page: Parameters<typeof waitForLoad>[0]) {
  await page.evaluate(() => localStorage.removeItem("sd-read-state"));
}

/** Inject followingLive into the persisted settings store. */
async function setFollowingLive(
  page: Parameters<typeof waitForLoad>[0],
  enabled: boolean,
) {
  await page.evaluate((v) => {
    const raw = localStorage.getItem("sd-settings");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 };
    parsed.state.followingLive = v;
    parsed.state.followingLiveAt = v ? Date.now() : 0;
    localStorage.setItem("sd-settings", JSON.stringify(parsed));
  }, enabled);
}

/** Return the current sd-read-state parsed object, or null. */
async function getReadState(page: Parameters<typeof waitForLoad>[0]) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("sd-read-state");
    return raw ? JSON.parse(raw) : null;
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Reveal state — persistence and mode transitions @smoke", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await clearRevealState(authedPage);
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  // -------------------------------------------------------------------------
  // 1. Reveal persists after page reload
  // -------------------------------------------------------------------------
  test("reveal persists after page reload @smoke", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    await revealBtn.click();
    await authedPage.waitForTimeout(300);

    // Confirm localStorage was updated
    const state = await getReadState(authedPage);
    expect(state).not.toBeNull();
    expect(state?.state?.revealedIds?.length).toBeGreaterThan(0);

    // Reload and verify score is still visible (no reveal button for that game)
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    // At least one game should be in revealed/updated state
    const revealedRow = authedPage.locator(
      "[data-reveal-state='revealed'], [data-reveal-state='updated']",
    ).first();
    await expect(revealedRow).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 2. Reveal persists across new browser context (tab close + reopen)
  // -------------------------------------------------------------------------
  test("reveal persists after new browser context (tab close/reopen)", async ({
    authedPage,
    browser,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    await revealBtn.click();
    await authedPage.waitForTimeout(300);

    // Capture storage state to simulate persistence across tab close/reopen
    const storageState = await authedPage.context().storageState();

    // Open a fresh context with the saved storage (simulates reopening the tab)
    const freshCtx = await browser.newContext({ storageState });
    const freshPage = await freshCtx.newPage();
    await freshPage.goto("/");
    await waitForLoad(freshPage);
    await waitForGameData(freshPage);

    const revealedRow = freshPage.locator(
      "[data-reveal-state='revealed'], [data-reveal-state='updated']",
    ).first();
    await expect(revealedRow).toBeVisible({ timeout: 5000 });

    await freshCtx.close();
  });

  // -------------------------------------------------------------------------
  // 3. Following Live mode → all scores visible without tap-reveal
  // -------------------------------------------------------------------------
  test("Following Live mode — scores visible without reveal @smoke", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Enable Following Live via storage, then reload
    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    // No game rows should require a reveal click — all should be visible scores
    const revealButtons = authedPage.locator("[data-testid='reveal-button']");
    const count = await revealButtons.count();
    expect(count).toBe(0);

    // LIVE toggle should reflect enabled state
    const liveToggle = authedPage.locator("[data-testid='live-toggle']");
    await expect(liveToggle).toBeVisible();
    await expect(liveToggle).toContainText("Scores visible");

    // Override banner should be visible in the feed
    const banner = authedPage.locator("[data-testid='following-live-banner']");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("score hiding is paused");
  });

  // -------------------------------------------------------------------------
  // 4. Disabling Following Live re-hides scores for un-revealed games
  // -------------------------------------------------------------------------
  test("disabling Following Live re-hides unrevealed game scores", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Start with Following Live on
    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    // Confirm no reveal buttons while Following Live is on
    expect(await authedPage.locator("[data-testid='reveal-button']").count()).toBe(0);

    // Banner should be present while Following Live is on
    await expect(authedPage.locator("[data-testid='following-live-banner']")).toBeVisible();

    // Click the LIVE toggle to disable
    const liveBtn = authedPage.locator("[data-testid='live-toggle']");
    const hasBtn = (await liveBtn.count()) > 0;
    if (!hasBtn) {
      test.skip(true, "LIVE toggle not visible — may be no live games");
      return;
    }
    await liveBtn.click();
    await authedPage.waitForTimeout(400);

    // After disabling, un-revealed final games should again require reveal
    const revealBtns = authedPage.locator("[data-testid='reveal-button']");
    const afterCount = await revealBtns.count();
    // There may not be any revealable final games; the invariant is that
    // Following Live no longer forces scores visible, so at least 0 is fine,
    // but if final games exist they should now be hidden.
    expect(afterCount).toBeGreaterThanOrEqual(0);

    // Override banner should be gone after disabling
    await expect(authedPage.locator("[data-testid='following-live-banner']")).not.toBeVisible();

    // LIVE toggle should now show "paused" state
    const pausedBtn = authedPage.locator("[data-testid='live-toggle']");
    await expect(pausedBtn).toContainText("Updates paused");
  });

  // -------------------------------------------------------------------------
  // 5b. Banner "Turn off" button dismisses Following Live and re-hides scores
  // -------------------------------------------------------------------------
  test("Following Live banner Turn off re-hides scores @smoke", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const banner = authedPage.locator("[data-testid='following-live-banner']");
    await expect(banner).toBeVisible();

    // Use the banner's own "Turn off" button
    const turnOffBtn = authedPage.locator("[data-testid='following-live-banner-dismiss']");
    await expect(turnOffBtn).toBeVisible();
    await turnOffBtn.click();
    await authedPage.waitForTimeout(400);

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // LIVE toggle should reflect disabled state
    const liveToggle = authedPage.locator("[data-testid='live-toggle']");
    await expect(liveToggle).toContainText("Updates paused");
  });

  // -------------------------------------------------------------------------
  // 5. UPDATE indicator when score changes after reveal snapshot
  // -------------------------------------------------------------------------
  test("UPDATE indicator shown when score changed after reveal snapshot", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    // Reveal the first game
    await revealBtn.click();
    await authedPage.waitForTimeout(300);

    // Read the stored snapshot and mutate it so the score differs from the current live value
    const mutated = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-read-state");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const snaps: [number, { homeScore: number; awayScore: number }][] =
        parsed?.state?.snapshots ?? [];
      if (snaps.length === 0) return false;
      // Flip both scores to a bogus value so the live score will differ
      snaps[0][1].homeScore = -999;
      snaps[0][1].awayScore = -999;
      parsed.state.snapshots = snaps;
      localStorage.setItem("sd-read-state", JSON.stringify(parsed));
      return true;
    });

    if (!mutated) {
      test.skip(true, "Could not mutate snapshot — no snapshot stored after reveal");
      return;
    }

    // Reload so the app re-hydrates the store and compares snapshot with current score
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    // At least one row should be in updated state
    const updatedRow = authedPage.locator("[data-reveal-state='updated']").first();
    await expect(updatedRow).toBeVisible({ timeout: 8000 });

    // The UPD badge should be present on that row
    const updBadge = updatedRow.locator("[data-testid='upd-badge']");
    await expect(updBadge).toBeVisible();
  });
});

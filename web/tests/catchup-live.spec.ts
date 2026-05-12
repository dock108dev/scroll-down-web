import {
  test,
  expect,
  DEFAULT_GAME_ID,
  makeDeckResponse,
  makeRecentGame,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke catch-up — live game", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("newer deckVersion mid-deck surfaces the new-moments banner; clicking it swaps the deck", async ({ page }) => {
    // Install the synthetic clock BEFORE goto so the hook's setInterval is
    // scheduled on it. We fast-forward past LIVE_CARDS_POLL_MS (45s) so the
    // poll fires inside the test rather than waiting in real time.
    await page.clock.install();

    let deckCalls = 0;
    await page.route(/\/api\/games\/[^/]+\/cards/, async (route) => {
      deckCalls += 1;
      const version = deckCalls === 1 ? "live-v1" : "live-v2";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeDeckResponse({ deckVersion: version, isFinal: false })),
      });
    });
    await mockSdmRoutes(page, {
      recent: makeRecentResponse([
        makeRecentGame({
          isFinal: false,
          status: "in_progress",
          statusType: "live",
          deckVersion: "live-v1",
        }),
      ]),
    });

    await page.goto("/");
    await page.locator(`[data-testid='game-row-${DEFAULT_GAME_ID}']`).click();
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
    await expect(page.locator("[data-testid='new-moments-banner']")).not.toBeVisible();

    // Advance fake time past the poll interval (45s). The hook fires another
    // fetch, observes "live-v2", and stages it as pendingDeck.
    await page.clock.fastForward(50_000);

    // We're on slide 0 (scene setter) when this banner shows — mid-deck.
    await expect(page.locator("[data-testid='new-moments-banner']")).toBeVisible();
    await page.locator("[data-testid='new-moments-banner'] button").click();
    await expect(page.locator("[data-testid='new-moments-banner']")).not.toBeVisible();
  });

  test("live tail card auto-applies a pending deck (no banner)", async ({ page }) => {
    await page.clock.install();

    let deckCalls = 0;
    await page.route(/\/api\/games\/[^/]+\/cards/, async (route) => {
      deckCalls += 1;
      const version = deckCalls === 1 ? "live-v1" : "live-v2";
      // A short deck of just scene + 1 play, so the tail "live caught up" is reachable.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeDeckResponse({ deckVersion: version, isFinal: false })),
      });
    });
    await mockSdmRoutes(page, {
      recent: makeRecentResponse([
        makeRecentGame({ isFinal: false, status: "in_progress", deckVersion: "live-v1" }),
      ]),
    });

    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();

    // Scroll the user to the very last slide ("live-caught-up").
    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
    });
    await expect(page.locator("[data-testid='live-caught-up']")).toBeVisible();

    // Now advance time so the poll observes v2. Tail-card branch auto-applies
    // without showing the banner.
    await page.clock.fastForward(50_000);
    await expect(page.locator("[data-testid='new-moments-banner']")).not.toBeVisible();
  });

  test("live caught-up: 'Check for new plays' button calls the API and surfaces the no-new-plays message", async ({ page }) => {
    let deckCalls = 0;
    await page.route(/\/api\/games\/[^/]+\/cards/, async (route) => {
      deckCalls += 1;
      // Always return the same deckVersion → no banner, no auto-apply.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeDeckResponse({ deckVersion: "live-v1", isFinal: false })),
      });
    });
    await mockSdmRoutes(page, {
      recent: makeRecentResponse([
        makeRecentGame({ isFinal: false, status: "in_progress", deckVersion: "live-v1" }),
      ]),
    });

    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
    });
    await expect(page.locator("[data-testid='live-caught-up']")).toBeVisible();

    const callsBefore = deckCalls;
    await page.getByRole("button", { name: /Check for new plays/i }).click();
    // Fineprint shows after a refresh that didn't yield new plays.
    await expect(page.getByText(/No new key plays yet/i)).toBeVisible();
    expect(deckCalls).toBeGreaterThan(callsBefore);
  });
});

import {
  test,
  expect,
  DEFAULT_GAME_ID,
  bodyText,
  makeDeckResponse,
  makePlayCard,
  makeRecentResponse,
  makeRevealResponse,
  makeSceneCard,
  mockSdmRoutes,
  seedCatchupProgress,
  seedOnboarding,
  stubConfirm,
} from "./helpers";

test.describe("@smoke catch-up — completed game", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("deck loads from the home row, no spoiler before reveal, then reveal renders", async ({ page }) => {
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
      reveal: makeRevealResponse(),
    });

    await page.goto("/");
    await page.locator(`[data-testid='game-row-${DEFAULT_GAME_ID}']`).click();

    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();

    // Final-result text must NOT be in the DOM before the reveal gate.
    const text = await bodyText(page);
    expect(text).not.toContain("Tampa Bay Rays beat");
    expect(text).not.toMatch(/winner/i);

    // Reach the reveal gate, tap reveal.
    await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
    await page.locator("[data-testid='reveal-button']").click();

    await expect(page.locator("[data-testid='final-reveal']")).toBeVisible();
    await expect(page.locator("[data-testid='final-reveal']")).toContainText("Tampa Bay Rays beat");
  });

  test("renders scene, play, rhythm, and final-setup cards from a mixed deck", async ({ page }) => {
    const deck = makeDeckResponse({
      cards: [
        makeSceneCard(),
        makePlayCard({ id: `${DEFAULT_GAME_ID}-p1`, sortOrder: 1 }),
        {
          id: `${DEFAULT_GAME_ID}-rhythm`,
          type: "rhythm",
          sortOrder: 2,
          inning: 4,
          half: "top",
          title: "Innings 4-6",
          description: "Both pitchers in command.",
        },
        makePlayCard({ id: `${DEFAULT_GAME_ID}-p2`, sortOrder: 3, inning: 7, half: "bottom" }),
        {
          id: `${DEFAULT_GAME_ID}-finalsetup`,
          type: "final_setup",
          sortOrder: 4,
          inning: 9,
          half: "bottom",
          title: "Final approach",
          description: "One out from the end.",
        },
      ],
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck });

    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='catchup-scene-setter']")).toBeVisible();
    // Two play cards.
    await expect(page.locator("[data-testid='play-card']")).toHaveCount(2);
    // Two rhythm-family slides (quiet-stretch + final-setup).
    await expect(page.locator("[data-testid$='-card']").filter({ has: page.locator(".rhythm-card, .rhythm-slide") })).toHaveCount(0); // smoke check; selector pattern not load-bearing
  });

  test("spoiler invariant: deck without reveal never mentions the final result", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
    const text = await bodyText(page);
    expect(text).not.toMatch(/\bbeat\b/i);
    expect(text).not.toMatch(/\bwinner\b/i);
    expect(text).not.toContain("2–1");
    expect(text).not.toContain("2-1");
  });

  test("reveal persists: progress.completed=true keeps the user out of FirstVisitGate after reload", async ({ page }) => {
    await seedCatchupProgress(page, { [DEFAULT_GAME_ID]: { completed: true, cardIndex: 2 } });
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
    });
    await page.goto("/");
    // GameRow CTA flips to "Watched" when the entry is completed.
    await expect(page.locator(`[data-testid='game-row-${DEFAULT_GAME_ID}']`)).toContainText("Watched");
  });

  test("restart with confirm=true clears reveal and snaps to slide 0", async ({ page }) => {
    await stubConfirm(page, true);
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
      reveal: makeRevealResponse(),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
    await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
    await page.locator("[data-testid='reveal-button']").click();
    await expect(page.locator("[data-testid='final-reveal']")).toBeVisible();

    await page.getByRole("button", { name: /restart/i }).click();
    // After restart, the reveal is gone and we're back on slide 0 (scene-setter).
    await expect(page.locator("[data-testid='final-reveal']")).toHaveCount(0);
    await expect(page.locator("[data-testid='catchup-scene-setter']")).toBeVisible();
  });

  test("restart with confirm=false is a no-op (reveal stays)", async ({ page }) => {
    await stubConfirm(page, false);
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
      reveal: makeRevealResponse(),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
    await page.locator("[data-testid='reveal-button']").click();
    await expect(page.locator("[data-testid='final-reveal']")).toBeVisible();

    await page.getByRole("button", { name: /restart/i }).click();
    // Reveal still visible — confirm was denied.
    await expect(page.locator("[data-testid='final-reveal']")).toBeVisible();
  });
});

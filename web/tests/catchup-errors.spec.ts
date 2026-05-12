import {
  test,
  expect,
  DEFAULT_GAME_ID,
  bodyText,
  makeDeckResponse,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke catch-up — error & edge states", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("deck 404 renders the empty state, not a crash", async ({ page }) => {
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: { status: 404, body: { error: "No deck for this game yet." } },
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator(".catchup-empty, .catchup-error").first()).toBeVisible();
    await expect(page.locator("[data-testid='play-card']")).toHaveCount(0);
  });

  test("deck 500 shows the error block with a Retry that recovers", async ({ page }) => {
    let attempt = 0;
    await page.route(/\/api\/games\/[^/]+\/cards/, async (route) => {
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "boom" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(makeDeckResponse()),
        });
      }
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse() });

    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    const retry = page.locator(".catchup-error-retry");
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
  });

  test("reveal 409 shows the pending message; no winner leak", async ({ page }) => {
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
      reveal: { status: 409, body: { error: "Reveal not available yet for this game." } },
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
    await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
    await page.locator("[data-testid='reveal-button']").click();
    await expect(page.locator("[data-testid='final-reveal-pending']")).toBeVisible();
    const text = await bodyText(page);
    expect(text).not.toContain("Rays beat");
    expect(text).not.toContain("Giants beat");
  });

  test("reveal 500 shows the inline error, not a crash", async ({ page }) => {
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse(),
      reveal: { status: 500, body: { error: "boom" } },
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
    await page.locator("[data-testid='reveal-button']").click();
    await expect(page.locator(".final-reveal-error")).toBeVisible();
  });

  test("non-numeric gameId shows the friendly fallback", async ({ page }) => {
    await page.goto("/catchup/not-a-number");
    await expect(page.getByText(/That game link doesn['’]t look right/i)).toBeVisible();
  });

  test("empty deck (cards: []) shows the empty state", async ({ page }) => {
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator(".catchup-empty")).toBeVisible();
  });
});

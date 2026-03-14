import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Mobile Responsive Layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("BottomTabs nav is visible at mobile width", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // BottomTabs is the fixed-bottom nav (has Settings button, not link)
    const bottomNav = authedPage.locator("nav.fixed");
    await expect(bottomNav).toBeVisible();

    // Check that expected tab labels are present in bottom nav
    for (const label of ["Games", "FairBet", "Settings"]) {
      await expect(bottomNav.getByText(label)).toBeVisible();
    }
  });

  test("Bottom tab navigation works - clicking FairBet tab navigates to /fairbet", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Click FairBet tab in bottom nav (use fixed nav to avoid hidden desktop nav)
    const bottomNav = authedPage.locator("nav.fixed");
    const fairbetTab = bottomNav.getByText("FairBet");
    await fairbetTab.click();
    await authedPage.waitForURL(/\/fairbet/, { timeout: 5000 });
    expect(authedPage.url()).toContain("/fairbet");
  });

  test("Game rows render at mobile width", async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRows = authedPage.locator("[data-testid='game-row']");
    const count = await gameRows.count();
    expect(count).toBeGreaterThan(0);

    // First game row should be visible and within viewport width
    const firstGame = gameRows.first();
    await expect(firstGame).toBeVisible();
    const box = await firstGame.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);
  });

  test("Login page form is usable at mobile width", async ({
    authedPage,
  }) => {
    await authedPage.goto("/login");
    await waitForLoad(authedPage);

    // Email input should be visible and interactable
    const emailInput = authedPage.getByPlaceholder("you@example.com");
    await expect(emailInput).toBeVisible();

    const box = await emailInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);

    // Input should be fillable
    await emailInput.fill("test@example.com");
    expect(await emailInput.inputValue()).toBe("test@example.com");
  });
});

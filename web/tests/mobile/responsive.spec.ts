import { test, expect, waitForLoad } from "../helpers";

test.describe("Mobile Responsive Layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("BottomTabs nav is visible at mobile width", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // BottomTabs should be visible on mobile (nav with md:hidden)
    const bottomNav = authedPage.locator("nav").filter({
      has: authedPage.locator("text=Games"),
    });
    await expect(bottomNav).toBeVisible();

    // Check that expected tab labels are present
    for (const label of ["Games", "FairBet", "Settings"]) {
      await expect(authedPage.getByText(label).first()).toBeVisible();
    }
  });

  test("Bottom tab navigation works - clicking FairBet tab navigates to /fairbet", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Click FairBet tab in bottom nav
    const fairbetTab = authedPage.getByText("FairBet").first();
    await fairbetTab.click();
    await authedPage.waitForURL(/\/fairbet/, { timeout: 5000 });
    expect(authedPage.url()).toContain("/fairbet");
  });

  test("Game rows render at mobile width", async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Game rows should be visible
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

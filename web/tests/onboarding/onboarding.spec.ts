import { test, expect, waitForLoad, clearAppState } from "../helpers";

test.describe("Onboarding flow", () => {
  test("new user sees onboarding, completes it, and enters game list with chosen reveal mode", async ({
    authedPage,
  }) => {
    // Clear all state to simulate first-time user
    await authedPage.goto("/");
    await clearAppState(authedPage);
    await authedPage.reload();

    // Step 1: Splash screen is visible
    const step1 = authedPage.locator("[data-testid='onboarding-step-1']");
    await expect(step1).toBeVisible({ timeout: 5000 });
    await expect(
      authedPage.getByText("The best fans don't watch the scoreboard"),
    ).toBeVisible();

    // Click "Show me" to proceed to Step 2
    await authedPage.locator("[data-testid='onboarding-cta-1']").click();

    // Step 2: Interactive demo is visible
    const step2 = authedPage.locator("[data-testid='onboarding-step-2']");
    await expect(step2).toBeVisible({ timeout: 3000 });

    // Tooltip 1 should be visible
    await expect(
      authedPage.locator("[data-testid='onboarding-tooltip-1']"),
    ).toBeVisible();

    // Tap the reveal button in the demo
    await authedPage.locator("[data-testid='onboarding-demo-reveal']").click();

    // Score should appear
    await expect(
      authedPage.locator("[data-testid='onboarding-demo-score']"),
    ).toBeVisible({ timeout: 2000 });

    // Tooltip 2 should appear
    await expect(
      authedPage.locator("[data-testid='onboarding-tooltip-2']"),
    ).toBeVisible();

    // Step 3: Preference selector auto-advances after 2s
    const step3 = authedPage.locator("[data-testid='onboarding-step-3']");
    await expect(step3).toBeVisible({ timeout: 5000 });

    // "Tap to reveal" (onMarkRead) should be selected by default
    const tapRevealBtn = authedPage.locator(
      "[data-testid='onboarding-pref-onMarkRead']",
    );
    await expect(tapRevealBtn).toBeVisible();

    // Select "Always hide" preference
    await authedPage
      .locator("[data-testid='onboarding-pref-blacklist']")
      .click();

    // Click "Let's go" to finish
    await authedPage.locator("[data-testid='onboarding-cta-finish']").click();

    // Should now see the home page game list
    await expect(
      authedPage.locator("[data-testid='page-home']"),
    ).toBeVisible({ timeout: 5000 });

    // Onboarding should be marked complete in localStorage
    const completed = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-onboarding");
      if (!raw) return false;
      return JSON.parse(raw).completed === true;
    });
    expect(completed).toBe(true);

    // Settings should reflect chosen reveal mode
    const mode = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      if (!raw) return null;
      return JSON.parse(raw).state?.scoreRevealMode;
    });
    expect(mode).toBe("blacklist");
  });

  test("returning user lands directly on game list", async ({
    authedPage,
  }) => {
    // Set onboarding as completed
    await authedPage.goto("/");
    await authedPage.evaluate(() => {
      localStorage.setItem(
        "sd-onboarding",
        JSON.stringify({ completed: true, completedAt: Date.now() }),
      );
    });
    await authedPage.reload();

    // Should see game list directly, not onboarding
    await expect(
      authedPage.locator("[data-testid='page-home']"),
    ).toBeVisible({ timeout: 5000 });

    // Onboarding should NOT be visible
    await expect(
      authedPage.locator("[data-testid='onboarding-flow']"),
    ).not.toBeVisible();
  });
});

import { test, expect } from "../helpers";

test.describe("Reveal hero strip", () => {
  test("shows hidden-score copy in hide-by-default mode", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    const hero = page.getByTestId("reveal-hero");
    await expect(hero).toBeVisible({ timeout: 5_000 });
    await expect(hero).toContainText("Scores are hidden by default.");

    await ctx.close();
  });

  test("remains visible after onboarding is dismissed and page reloaded", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    // Dismiss onboarding
    await page.getByTestId("reveal-onboarding-dismiss").click();
    await page.getByTestId("reveal-onboarding-dismiss").click();

    await page.reload();
    await expect(page.getByTestId("reveal-hero")).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

  test("is visible for logged-out users", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    await expect(page.getByTestId("reveal-hero")).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

});

test.describe("Reveal mode onboarding banner", () => {
  test("shows on first visit (no sd-onboarding-seen flag)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    await expect(page.getByTestId("reveal-onboarding")).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

  test("does not show after dismiss + reload", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    const banner = page.getByTestId("reveal-onboarding");
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Step 1 → click Next
    await page.getByTestId("reveal-onboarding-dismiss").click();
    // Step 2 → click Got it
    await page.getByTestId("reveal-onboarding-dismiss").click();

    // sd-onboarding-seen must be set
    const flag = await page.evaluate(() => localStorage.getItem("sd-onboarding-seen"));
    expect(flag).toBe("1");

    // Reload: banner must not appear
    await page.reload();
    await expect(page.getByTestId("reveal-onboarding")).toBeHidden({ timeout: 5_000 });

    await ctx.close();
  });

  test("does not show when user already has revealed games", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Seed sd-read-state with one revealed ID
    await page.goto("/");
    await page.evaluate(() => {
      const state = { state: { revealedIds: [12345], snapshots: [] }, version: 1 };
      localStorage.setItem("sd-read-state", JSON.stringify(state));
    });

    await page.reload();
    await expect(page.getByTestId("reveal-onboarding")).toBeHidden({ timeout: 5_000 });

    await ctx.close();
  });
});

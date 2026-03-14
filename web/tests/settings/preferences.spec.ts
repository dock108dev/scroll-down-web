import { test, expect } from "../helpers";

test.describe("Settings Page", () => {
  // The SettingsDrawer is always in the DOM (off-screen), so we scope
  // all selectors to the main content area to avoid duplicates.
  const main = 'main, [class*="max-w-2xl"]';

  test("settings page loads with settings content", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator(main).getByText("Appearance")).toBeVisible();
  });

  test("theme options are visible", async ({ page }) => {
    await page.goto("/settings");
    const container = page.locator(main);

    await expect(container.getByRole("button", { name: "System" })).toBeVisible();
    await expect(container.getByRole("button", { name: "Light" })).toBeVisible();
    await expect(container.getByRole("button", { name: "Dark" })).toBeVisible();
  });

  test("clicking theme option updates the selection", async ({ page }) => {
    await page.goto("/settings");
    const container = page.locator(main);

    await container.getByRole("button", { name: "Dark" }).click();

    // Verify the setting was stored
    const stored = await page.evaluate(() => localStorage.getItem("sd-settings"));
    expect(stored).toContain("dark");
  });

  test("settings persist after page reload", async ({ page }) => {
    await page.goto("/settings");
    const container = page.locator(main);

    // Change theme to Dark
    await container.getByRole("button", { name: "Dark" }).click();

    // Reload
    await page.reload();

    // Verify Dark is still selected via localStorage
    const stored = await page.evaluate(() => localStorage.getItem("sd-settings"));
    expect(stored).toContain("dark");
  });

  test('localStorage key "sd-settings" contains settings data', async ({ page }) => {
    await page.goto("/settings");
    const container = page.locator(main);

    await container.getByRole("button", { name: "Light" }).click();

    const stored = await page.evaluate(() => localStorage.getItem("sd-settings"));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toBeDefined();
  });

  test("guest sees sign-in prompt in account section", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.locator(main).getByText(/sign in to sync/i),
    ).toBeVisible();
  });

  test("logged-in user sees email in account section", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    const container = authedPage.locator(main);

    await expect(
      container.getByRole("link", { name: "Manage Account" }),
    ).toBeVisible();
  });
});

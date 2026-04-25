import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet Page - In-Game Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("Pre-Game and In-Game tabs are both visible", async ({ page }) => {
    const main = page.locator("main");
    await expect(main.getByRole("tab", { name: "Pre-Game" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "In-Game" })).toBeVisible();
  });

  test("clicking In-Game tab activates it and shows the panel", async ({ page }) => {
    const main = page.locator("main");
    const liveTab = main.getByRole("tab", { name: "In-Game" });
    await liveTab.click();

    await expect(liveTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#tabpanel-live")).toBeVisible();
  });

  test("switching back to Pre-Game shows the pre-game panel", async ({ page }) => {
    const main = page.locator("main");
    await main.getByRole("tab", { name: "In-Game" }).click();
    await expect(page.locator("#tabpanel-live")).toBeVisible();

    await main.getByRole("tab", { name: "Pre-Game" }).click();
    await expect(page.locator("#tabpanel-pregame")).toBeVisible();
  });
});

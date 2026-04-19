import { test, expect } from "../helpers";

test.describe("Nav visibility @smoke", () => {
  test("logged-out user sees exactly Games and FairBet nav links", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Primary nav links (Games, FairBet) are hidden until md breakpoint in TopNav",
    );

    await page.goto("/");
    const nav = page.locator("[data-testid='top-nav'] nav");
    const links = nav.locator("a[href]").filter({ hasText: /^(Games|FairBet|Golf|Analytics|History)$/ });
    await expect(links).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Games" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "FairBet" })).toBeVisible();
  });
});

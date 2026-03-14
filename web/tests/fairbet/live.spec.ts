import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet Page - Live Tab (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("guest sees auth gate on Live tab", async ({ page }) => {
    // Scope to main to avoid the header "LIVE" SSE indicator button
    const main = page.locator("main");
    const liveTab = main.getByRole("button", { name: "Live" });
    await liveTab.click();

    await expect(
      page.getByText("Sign up for free to access live odds")
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Sign Up Free" })
    ).toBeVisible();
  });

  test('"Sign Up Free" links to /login?tab=signup', async ({ page }) => {
    const main = page.locator("main");
    const liveTab = main.getByRole("button", { name: "Live" });
    await liveTab.click();

    const signUpLink = page.getByRole("link", { name: "Sign Up Free" });
    await expect(signUpLink).toHaveAttribute("href", "/login?tab=signup");
  });

  test("switching between Pre-Game and Live tabs works", async ({ page }) => {
    const main = page.locator("main");
    const preGameTab = main.getByRole("button", { name: "Pre-Game" });
    const liveTab = main.getByRole("button", { name: "Live" });

    // Both tabs should be visible
    await expect(preGameTab).toBeVisible();
    await expect(liveTab).toBeVisible();

    // Switch to Live
    await liveTab.click();
    await expect(page.getByText(/sign up for free|live odds/i)).toBeVisible();

    // Switch back to Pre-Game
    await preGameTab.click();
    // Auth gate text should disappear
    await expect(
      page.getByText("Sign up for free to access live odds")
    ).not.toBeVisible();
  });
});

test.describe("FairBet Page - Live Tab (Logged In)", () => {
  test("logged-in user sees Live tab content without auth gate", async ({
    authedPage,
  }) => {
    await authedPage.goto("/fairbet");
    await waitForLoad(authedPage);

    const main = authedPage.locator("main");
    const liveTab = main.getByRole("button", { name: "Live" });
    await liveTab.click();

    // Auth gate message should NOT appear for logged-in users
    await expect(
      authedPage.getByText("Sign up for free to access live odds")
    ).not.toBeVisible();

    // Sign Up Free link should NOT appear
    await expect(
      authedPage.getByRole("link", { name: "Sign Up Free" })
    ).not.toBeVisible();
  });
});

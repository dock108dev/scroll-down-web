import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("Error handling: API errors", () => {
  test("home page handles 500 from games API", async ({ page }) => {
    await page.route("**/api/games**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    await page.goto("/");
    await waitForLoad(page);

    // Page should still render navigation
    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("game detail handles 500 gracefully", async ({ page }) => {
    await page.route("**/api/games/*", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    await page.goto("/game/1");
    await waitForLoad(page);

    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("golf page handles network timeout", async ({ page }) => {
    await page.route("**/api/golf/tournaments**", (route) =>
      route.abort("timedout"),
    );

    await page.goto("/golf");
    await page.waitForLoadState("domcontentloaded");

    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });

  test("fairbet page handles malformed JSON", async ({ page }) => {
    await page.route("**/api/fairbet/**", (route) =>
      route.fulfill({
        status: 200,
        body: "not valid json {{{",
        headers: { "content-type": "application/json" },
      }),
    );

    await page.goto("/fairbet");
    await page.waitForLoadState("domcontentloaded");

    const topNav = page.locator("[data-testid='top-nav']");
    await expect(topNav).toBeVisible();
  });
});

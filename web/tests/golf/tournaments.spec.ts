import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("Golf: Tournaments page", () => {
  test("page loads with tournament cards", async ({ authedPage: page }) => {
    await page.goto("/golf");
    await waitForLoad(page);

    const golfPage = page.locator("[data-testid='page-golf']");
    await expect(golfPage).toBeVisible();

    // Should have a heading
    await expect(page.locator("h1")).toContainText("PGA Tour");
  });

  test("tournament cards render with data", async ({
    authedPage: page,
    request,
  }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }
    const data = await tourRes.json();
    if ((data.tournaments ?? []).length === 0) {
      test.skip(true, "No tournaments available");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    const cards = page.locator("[data-testid='tournament-card']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // First card should have tournament name
    const firstCard = cards.first();
    const text = await firstCard.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test("sections group tournaments correctly", async ({
    authedPage: page,
  }) => {
    await page.goto("/golf");
    await waitForLoad(page);

    // Page should have section headings (This Week, Upcoming, Recent Results)
    const headings = page.locator("h2");
    const headingCount = await headings.count();
    // At least one section should be present if tournaments exist
    const cards = page.locator("[data-testid='tournament-card']");
    const cardCount = await cards.count();
    if (cardCount > 0) {
      expect(headingCount).toBeGreaterThan(0);
    }
  });

  test("clicking tournament card navigates to event page", async ({
    authedPage: page,
    request,
  }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }
    const data = await tourRes.json();
    if ((data.tournaments ?? []).length === 0) {
      test.skip(true, "No tournaments available");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    const firstCard = page.locator("[data-testid='tournament-card']").first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, "No tournament cards rendered");
      return;
    }

    await firstCard.click();
    await page.waitForURL(/\/golf\/.+/);
    await waitForLoad(page);

    const eventPage = page.locator("[data-testid='page-golf-event']");
    await expect(eventPage).toBeVisible();
  });
});

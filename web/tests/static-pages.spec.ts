import {
  test,
  expect,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke static pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
    // Static pages don't fetch games themselves, but the layout's FirstVisitGate
    // calls useGamesList which would hit the real BFF otherwise.
    await mockSdmRoutes(page, { recent: makeRecentResponse([]) });
  });

  test("privacy page renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("[data-testid='page-privacy']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("terms page renders", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("[data-testid='page-terms']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  });

  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("[data-testid='page-contact']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contact Us" })).toBeVisible();
  });

  test("topnav is present across pages", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("[data-testid='top-nav']")).toBeVisible();
  });
});

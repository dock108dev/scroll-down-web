import {
  test,
  expect,
  makeRecentGame,
  makeRecentResponse,
  mockSdmRoutes,
} from "./helpers";

test.describe("@smoke onboarding (FirstVisitGate)", () => {
  test("first visit shows the team-picker overlay", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    await expect(page.locator("[data-testid='team-picker']")).toBeVisible();
    await expect(page.locator("[data-testid='team-picker-confirm']")).toBeDisabled();
  });

  test("picking a team enables confirm; confirm routes to a recent game for that team", async ({ page }) => {
    const games = [
      makeRecentGame({
        gameId: "190140",
        gameDate: "2026-05-03",
        awayTeam: { id: "3", abbreviation: "LAD", displayName: "Los Angeles Dodgers" },
        homeTeam: { id: "4", abbreviation: "NYY", displayName: "New York Yankees" },
      }),
    ];
    await mockSdmRoutes(page, { recent: makeRecentResponse(games) });
    await page.goto("/");
    await expect(page.locator("[data-testid='team-picker']")).toBeVisible();
    await page.locator("[data-testid='team-pick-NYY']").click();
    await expect(page.locator("[data-testid='team-picker-confirm']")).toBeEnabled();
    await page.locator("[data-testid='team-picker-confirm']").click();
    // FirstVisitGate routes to /catchup/{gameId} when a recent game exists.
    await expect(page).toHaveURL(/\/catchup\/190140$/);
  });

  test("skip closes the picker and lands on the home page", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    await page.locator("[data-testid='team-picker-skip']").click();
    await expect(page.locator("[data-testid='team-picker']")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("[data-testid='page-home']")).toBeVisible();
  });

  test("pick + confirm with no games in the window still lands on home", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse([]) });
    await page.goto("/");
    await page.locator("[data-testid='team-pick-NYY']").click();
    await page.locator("[data-testid='team-picker-confirm']").click();
    await expect(page).toHaveURL(/\/$/);
  });
});

import {
  test,
  expect,
  makeRecentGame,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke home page", () => {
  test.beforeEach(async ({ page }) => {
    // All home tests assume the team-picker is dismissed so the home grid is
    // what the user sees first. The picker is exercised in onboarding.spec.ts.
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("empty list renders the off-season copy", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse([]) });
    await page.goto("/");
    await expect(page.getByText("No games in the last 48 hours.")).toBeVisible();
  });

  test("renders hero + other games when the list has multiple games", async ({ page }) => {
    const games = [
      makeRecentGame({ gameId: "190121", isFinal: true, status: "final", gameDate: "2026-05-03" }),
      makeRecentGame({
        gameId: "190122",
        isFinal: true,
        status: "final",
        gameDate: "2026-05-02",
        awayTeam: { id: "3", abbreviation: "LAD", displayName: "Los Angeles Dodgers" },
        homeTeam: { id: "4", abbreviation: "NYY", displayName: "New York Yankees" },
      }),
    ];
    await mockSdmRoutes(page, { recent: makeRecentResponse(games) });
    await page.goto("/");

    await expect(page.locator("[data-testid='page-home']")).toBeVisible();
    await expect(page.locator("[data-testid='game-row-190121']")).toBeVisible();
    await expect(page.locator("[data-testid='game-row-190122']")).toBeVisible();
    // The most recent final is the hero (data-featured=true).
    await expect(page.locator("[data-testid='game-row-190121']")).toHaveAttribute("data-featured", "true");
  });

  test("favorite team pins the hero to that team's most recent game", async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: "NYY" });
    const games = [
      makeRecentGame({ gameId: "190121", gameDate: "2026-05-03" }), // SF @ TB
      makeRecentGame({
        gameId: "190122",
        gameDate: "2026-05-02",
        awayTeam: { id: "3", abbreviation: "LAD", displayName: "Los Angeles Dodgers" },
        homeTeam: { id: "4", abbreviation: "NYY", displayName: "New York Yankees" },
      }),
    ];
    await mockSdmRoutes(page, { recent: makeRecentResponse(games) });
    await page.goto("/");

    await expect(page.locator("[data-testid='game-row-190122']")).toHaveAttribute("data-featured", "true");
    await expect(page.getByText(/Yankees catch-up/i)).toBeVisible();
  });

  test("favorite team not playing → falls back with explanatory copy", async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: "BOS" });
    const games = [makeRecentGame({ gameId: "190121", gameDate: "2026-05-03" })];
    await mockSdmRoutes(page, { recent: makeRecentResponse(games) });
    await page.goto("/");

    // The hero copy concatenates favTeam.name + " aren't playing" — match the
    // tail so we're robust to a11y-tree whitespace normalization.
    await expect(page.getByText(/aren['’]t playing/i)).toBeVisible();
    await expect(page.locator("[data-testid='game-row-190121']")).toHaveAttribute("data-featured", "true");
  });

  test("live game outranks finals in the hero slot", async ({ page }) => {
    const games = [
      makeRecentGame({
        gameId: "190121",
        gameDate: "2026-05-03",
        isFinal: true,
        status: "final",
      }),
      makeRecentGame({
        gameId: "190122",
        gameDate: "2026-05-02",
        isFinal: false,
        status: "in_progress",
      }),
    ];
    await mockSdmRoutes(page, { recent: makeRecentResponse(games) });
    await page.goto("/");
    await expect(page.locator("[data-testid='game-row-190122']")).toHaveAttribute("data-featured", "true");
  });

  test("pregame row is not a link", async ({ page }) => {
    const game = makeRecentGame({
      gameId: "190123",
      gameDate: "2050-01-01T18:00:00Z",
      isFinal: false,
      status: "scheduled",
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse([game]) });
    await page.goto("/");
    const row = page.locator("[data-testid='game-row-190123']");
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-disabled", "true");
    // Confirm it rendered as a div, not an anchor.
    await expect(row).toHaveJSProperty("tagName", "DIV");
  });

  test("500 from /api/games/recent shows error + retry that recovers", async ({ page }) => {
    let attempt = 0;
    await page.route("**/api/games/recent", async (route) => {
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(makeRecentResponse([makeRecentGame({ gameId: "190131" })])),
        });
      }
    });

    await page.goto("/");
    await expect(page.getByText(/We couldn['’]t load today['’]s games/i)).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator("[data-testid='game-row-190131']")).toBeVisible();
  });
});

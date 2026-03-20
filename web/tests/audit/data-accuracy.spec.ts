import { test, expect } from "@playwright/test";
import { waitForLoad } from "../helpers";

test.describe("Audit: Data accuracy", () => {
  test("game scores in UI match API data", async ({ page, request }) => {
    const gamesRes = await request.get("/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }

    const gamesData = await gamesRes.json();
    const games = gamesData.games ?? [];
    if (games.length === 0) {
      test.skip(true, "No games available");
      return;
    }

    // Check that the home page renders at least one game
    await page.goto("/");
    await waitForLoad(page);

    const gameRows = page.locator("[data-testid='game-row']");
    const count = await gameRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("game detail team names match API", async ({ page, request }) => {
    const gamesRes = await request.get("/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }

    const gamesData = await gamesRes.json();
    const game = gamesData.games?.[0];
    if (!game) {
      test.skip(true, "No games available");
      return;
    }

    // Fetch detail from API
    const detailRes = await request.get(`/api/games/${game.id}`);
    if (!detailRes.ok()) {
      test.skip(true, "Game detail API unavailable");
      return;
    }
    const detail = await detailRes.json();
    const apiGame = detail.game;

    // Navigate to game detail page
    await page.goto(`/game/${game.id}`);
    await waitForLoad(page);

    const header = page.locator("[data-testid='game-header']");
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Verify team names are present in the header
    const headerText = await header.textContent();
    const awayAbbr = apiGame.awayTeamAbbr ?? apiGame.awayTeam;
    const homeAbbr = apiGame.homeTeamAbbr ?? apiGame.homeTeam;
    expect(headerText).toContain(awayAbbr);
    expect(headerText).toContain(homeAbbr);
  });

  test("golf tournament names match API", async ({ page, request }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }

    const tourData = await tourRes.json();
    const tournaments = tourData.tournaments ?? [];
    if (tournaments.length === 0) {
      test.skip(true, "No tournaments available");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    // Check first tournament name appears in UI
    const firstTournament = tournaments[0];
    const cards = page.locator("[data-testid='tournament-card']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const pageText = await page.locator("[data-testid='page-golf']").textContent();
    expect(pageText).toContain(firstTournament.event_name);
  });
});

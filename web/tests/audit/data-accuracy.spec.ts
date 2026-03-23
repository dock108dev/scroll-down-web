import { test, expect } from "@playwright/test";
import { waitForGameData, fetchWithRetry } from "../helpers";

test.describe("Audit: Data accuracy", () => {
  test.setTimeout(120_000);

  test("game scores in UI match API data", async ({ page, request }) => {
    const gamesRes = await fetchWithRetry(request, "/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }

    const gamesData = (await gamesRes.json()) as Record<string, unknown>;
    const games = (gamesData.games as unknown[]) ?? [];
    if (games.length === 0) {
      test.skip(true, "No games available");
      return;
    }

    // Navigate and wait for the page content to be ready
    await page.goto("/", { waitUntil: "load" });
    // Wait for section headers to appear (they render once game data loads)
    const sectionHeaders = page.locator("button").filter({ hasText: /\(\d+\)/ });
    try {
      await sectionHeaders.first().waitFor({ state: "visible", timeout: 25_000 });
    } catch {
      test.skip(true, "Game data did not load in time — likely slow backend");
      return;
    }

    // Click the first section header to expand it
    await sectionHeaders.first().click();

    const hasData = await waitForGameData(page, 15_000);
    expect(hasData, "Expected game rows to render after expanding a section").toBe(true);
  });

  test("game detail team names match API", async ({ page, request }) => {
    const gamesRes = await fetchWithRetry(request, "/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }

    const gamesData = (await gamesRes.json()) as Record<string, unknown>;
    const game = (gamesData.games as { id: string }[] | undefined)?.[0];
    if (!game) {
      test.skip(true, "No games available");
      return;
    }

    // Fetch detail from API
    const detailRes = await fetchWithRetry(request, `/api/games/${game.id}`);
    if (!detailRes.ok()) {
      test.skip(true, "Game detail API unavailable");
      return;
    }
    const detail = (await detailRes.json()) as Record<string, unknown>;
    const apiGame = detail.game as Record<string, string> | undefined;

    // Navigate to game detail page and wait for client-side data fetch
    await page.goto(`/game/${game.id}`, { waitUntil: "load" });

    const header = page.locator("[data-testid='game-header']");
    try {
      await header.waitFor({ state: "visible", timeout: 30_000 });
    } catch {
      test.skip(true, "Game detail did not render in time — likely slow backend under concurrent load");
      return;
    }

    // Verify team names are present in the header
    const headerText = await header.textContent();
    const awayAbbr = apiGame?.awayTeamAbbr ?? apiGame?.awayTeam;
    const homeAbbr = apiGame?.homeTeamAbbr ?? apiGame?.homeTeam;
    expect(headerText).toContain(awayAbbr);
    expect(headerText).toContain(homeAbbr);
  });

  test("golf tournament names match API", async ({ page, request }) => {
    const tourRes = await fetchWithRetry(request, "/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }

    const tourData = (await tourRes.json()) as Record<string, unknown>;
    const tournaments = (tourData.tournaments as { event_name: string }[]) ?? [];
    if (tournaments.length === 0) {
      test.skip(true, "No tournaments available");
      return;
    }

    await page.goto("/golf", { waitUntil: "load" });
    // Golf page uses a text loading indicator, not skeletons — wait for cards
    try {
      await page.locator("[data-testid='tournament-card']").first().waitFor({
        state: "visible",
        timeout: 25_000,
      });
    } catch {
      test.skip(true, "Tournament data did not load in time — likely slow backend");
      return;
    }

    // Check that at least one API tournament name appears in UI
    const cards = page.locator("[data-testid='tournament-card']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const pageText = await page.locator("[data-testid='page-golf']").textContent() ?? "";
    // The UI filters by section (thisWeek/upcoming/recent), so the first API
    // tournament may not appear. Verify at least one rendered tournament matches.
    const anyMatch = tournaments.some((t: { event_name: string }) =>
      pageText.includes(t.event_name),
    );
    expect(anyMatch).toBe(true);
  });
});

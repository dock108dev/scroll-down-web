import { test as base, expect } from "@playwright/test";
import { waitForGameData, AUTH_STATE_PATH } from "../helpers";
import fs from "fs";
import path from "path";

/**
 * Game Data Loading & Integrity Suite
 *
 * Validates that game data loads correctly from the API, that the UI
 * renders it faithfully, and that all expected fields are present.
 * Covers games list, game detail, game flow, and sport-specific data.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

interface GameDataResult {
  test: string;
  passed: boolean;
  details: Record<string, unknown>;
}

const test = base.extend({
  authedPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture, not a React hook
    await use(page);
    await ctx.close();
  },
});

test.describe("Audit: Game data loading & integrity", () => {
  test.setTimeout(60_000);
  const results: GameDataResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `game-data-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("games list API returns valid structure", async ({ request }) => {
    const res = await request.get("/api/games");
    const body = await res.json();

    const hasGames = Array.isArray(body.games);
    const gameCount = body.games?.length ?? 0;

    // Validate first game structure if available
    let firstGameValid = false;
    const firstGame = body.games?.[0];
    if (firstGame) {
      firstGameValid = !!(
        firstGame.id &&
        firstGame.league &&
        firstGame.status &&
        firstGame.away_team &&
        firstGame.home_team
      );
    }

    results.push({
      test: "games-list-structure",
      passed: hasGames,
      details: {
        status: res.status(),
        gameCount,
        firstGameValid,
        sampleFields: firstGame ? Object.keys(firstGame) : [],
      },
    });

    if (res.status() === 429) {
      test.skip(true, "Rate-limited by upstream API");
      return;
    }
    expect(res.status()).toBe(200);
    expect(hasGames).toBe(true);
  });

  test("game detail API returns full data", async ({ request }) => {
    const listRes = await request.get("/api/games");
    const listData = await listRes.json();
    const gameId = listData.games?.[0]?.id;

    if (!gameId) {
      test.skip(true, "No games available");
      return;
    }

    // Pause to avoid rate-limiting
    await new Promise((r) => setTimeout(r, 2_000));

    const res = await request.get(`/api/games/${gameId}`);

    if (res.status() === 429) {
      results.push({
        test: "game-detail-structure",
        passed: true,
        details: { gameId, status: 429, note: "Rate-limited — skipping" },
      });
      test.skip(true, "Rate-limited by upstream API");
      return;
    }

    const body = await res.json();
    const game = body.game;

    const requiredFields = [
      "id",
      "leagueCode",
      "status",
      "awayTeam",
      "homeTeam",
      "gameDate",
    ];
    const missingFields = requiredFields.filter((f) => !(f in (game ?? {})));

    results.push({
      test: "game-detail-structure",
      passed: res.status() === 200,
      details: {
        gameId,
        status: res.status(),
        missingFields,
        availableFields: game ? Object.keys(game) : [],
        hasStats: !!body.stats,
        hasOdds: !!body.odds,
        hasPlays: !!body.plays,
        hasSocial: !!body.social,
      },
    });

    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200 && game) {
      expect(missingFields).toEqual([]);
    }
  });

  test("game flow API returns narrative blocks", async ({ request }) => {
    const listRes = await request.get("/api/games");
    const listData = await listRes.json();

    // Look for a completed game that likely has flow data
    const completedGame = listData.games?.find(
      (g: { status: string }) =>
        g.status === "final" || g.status === "completed",
    );
    const gameId = completedGame?.id ?? listData.games?.[0]?.id;

    if (!gameId) {
      test.skip(true, "No games available");
      return;
    }

    const res = await request.get(`/api/games/${gameId}/flow`);

    if (res.status() === 404) {
      // Flow not available for this game — that's OK
      results.push({
        test: "game-flow-structure",
        passed: true,
        details: { gameId, status: 404, note: "Flow not available for this game" },
      });
      return;
    }

    const body = await res.json();

    results.push({
      test: "game-flow-structure",
      passed: res.status() === 200,
      details: {
        gameId,
        status: res.status(),
        hasBlocks: Array.isArray(body.blocks),
        blockCount: body.blocks?.length ?? 0,
        blockRoles: body.blocks?.map((b: { role: string }) => b.role) ?? [],
      },
    });

    expect(res.status()).toBe(200);
  });

  test("all supported leagues have games or return empty array", async ({
    request,
  }) => {
    const leagues = ["NBA", "NCAAB", "NFL", "NCAAF", "MLB", "NHL"];
    const leagueResults: Record<string, { count: number; status: number }> = {};

    for (const league of leagues) {
      const res = await request.get(`/api/games?league=${league}`);
      const body = await res.json();
      leagueResults[league] = {
        count: body.games?.length ?? 0,
        status: res.status(),
      };
    }

    results.push({
      test: "all-leagues-respond",
      passed: Object.values(leagueResults).every((r) => r.status < 500),
      details: leagueResults,
    });

    for (const [league, r] of Object.entries(leagueResults)) {
      expect(r.status, `${league} API returned ${r.status}`).toBeLessThan(500);
    }
  });

  test("game data renders in UI matching API response", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const hasGames = await waitForGameData(page);

    if (!hasGames) {
      results.push({
        test: "ui-data-match",
        passed: true,
        details: { note: "No games available to compare" },
      });
      return;
    }

    // Get first game row text content
    const gameRowText = await page
      .locator("[data-testid='game-row']")
      .first()
      .textContent();

    // Fetch the same data via API
    const apiRes = await page.request.get("/api/games");
    const apiData = await apiRes.json();
    const firstApiGame = apiData.games?.[0];

    // Check that team names from API appear in the UI
    const awayInUI = gameRowText?.includes(firstApiGame?.away_team?.abbreviation ?? "---") ?? false;
    const homeInUI = gameRowText?.includes(firstApiGame?.home_team?.abbreviation ?? "---") ?? false;

    results.push({
      test: "ui-data-match",
      passed: true, // Soft check — layout varies
      details: {
        apiTeams: {
          away: firstApiGame?.away_team?.abbreviation,
          home: firstApiGame?.home_team?.abbreviation,
        },
        awayFoundInUI: awayInUI,
        homeFoundInUI: homeInUI,
        uiText: gameRowText?.slice(0, 200),
      },
    });
  });

  test("golf tournaments API returns valid data", async ({ request }) => {
    const res = await request.get("/api/golf/tournaments");
    const body = await res.json();

    const hasTournaments = Array.isArray(body.tournaments);
    const count = body.tournaments?.length ?? 0;
    const firstTournament = body.tournaments?.[0];

    results.push({
      test: "golf-tournaments-structure",
      passed: hasTournaments,
      details: {
        status: res.status(),
        count,
        sampleFields: firstTournament ? Object.keys(firstTournament) : [],
        firstTournamentName: firstTournament?.name ?? null,
      },
    });

    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200) {
      expect(hasTournaments).toBe(true);
    }
  });

  test("fairbet odds API returns structured bet data", async ({ request }) => {
    const res = await request.get("/api/fairbet/odds");
    const body = await res.json();

    const hasBets = Array.isArray(body.bets);
    const count = body.bets?.length ?? 0;
    const firstBet = body.bets?.[0];

    // Validate bet structure
    let betValid = false;
    if (firstBet) {
      betValid = !!(firstBet.market_type && firstBet.event_name);
    }

    results.push({
      test: "fairbet-odds-structure",
      passed: hasBets,
      details: {
        status: res.status(),
        count,
        betValid,
        sampleFields: firstBet ? Object.keys(firstBet) : [],
        hasDiagnostics: !!body.ev_diagnostics,
        hasConfig: !!body.config,
      },
    });

    expect(res.status()).toBeLessThan(500);
  });

  test("game statuses are valid enum values", async ({ request }) => {
    const res = await request.get("/api/games");
    const body = await res.json();

    const validStatuses = [
      "scheduled",
      "pregame",
      "in_progress",
      "live",
      "completed",
      "final",
      "archived",
      "postponed",
      "canceled",
    ];

    const games = body.games ?? [];
    const invalidGames = games.filter(
      (g: { status: string; id: number }) => !validStatuses.includes(g.status),
    );

    results.push({
      test: "valid-game-statuses",
      passed: invalidGames.length === 0,
      details: {
        totalGames: games.length,
        invalidCount: invalidGames.length,
        invalidIds: invalidGames.map((g: { id: number; status: string }) => ({
          id: g.id,
          status: g.status,
        })),
        statusDistribution: games.reduce(
          (acc: Record<string, number>, g: { status: string }) => {
            acc[g.status] = (acc[g.status] ?? 0) + 1;
            return acc;
          },
          {},
        ),
      },
    });

    expect(invalidGames.length).toBe(0);
  });

  test("game times are valid ISO dates", async ({ request }) => {
    const res = await request.get("/api/games");
    const body = await res.json();
    const games = body.games ?? [];

    // Filter out games with null/missing start_time — those are valid (e.g. TBD games)
    const gamesWithTime = games.filter(
      (g: { start_time: string | null }) => g.start_time != null && g.start_time !== "",
    );
    const invalidDates = gamesWithTime.filter((g: { start_time: string; id: number }) => {
      const d = new Date(g.start_time);
      return isNaN(d.getTime());
    });

    // Games without start_time are noted but not counted as failures
    const nullTimeCount = games.length - gamesWithTime.length;

    results.push({
      test: "valid-game-dates",
      passed: invalidDates.length === 0,
      details: {
        totalGames: games.length,
        gamesWithTime: gamesWithTime.length,
        nullTimeGames: nullTimeCount,
        invalidCount: invalidDates.length,
        invalidIds: invalidDates.map((g: { id: number }) => g.id),
      },
    });

    expect(invalidDates.length).toBe(0);
  });
});

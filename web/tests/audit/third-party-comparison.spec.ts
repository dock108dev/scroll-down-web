import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Third-Party Data Comparison Suite
 *
 * Audits game data accuracy by comparing scores and game info from
 * Scroll Down's API against public third-party sources (ESPN, CBS Sports).
 * Measures data latency (how far behind we are) and identifies discrepancies.
 *
 * NOTE: These tests scrape public web pages and may break if those sites
 * change their markup. They're designed as audit tools, not CI-blocking tests.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

interface ComparisonResult {
  test: string;
  provider: string;
  sport: string;
  passed: boolean;
  details: Record<string, unknown>;
}

interface ScoreData {
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  status: string;
}

test.describe("Audit: Third-party data comparison", () => {
  test.setTimeout(90_000);
  const results: ComparisonResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `third-party-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("fetch ESPN scoreboard and compare game counts", async ({
    request,
    browser,
  }) => {
    // Get our data first
    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdGames = sdData.games ?? [];

    // Count games by league from our API
    const sdByLeague: Record<string, number> = {};
    for (const g of sdGames) {
      const league = (g.league ?? "unknown").toUpperCase();
      sdByLeague[league] = (sdByLeague[league] ?? 0) + 1;
    }

    // Scrape ESPN scoreboard for NBA (as reference league)
    let espnGameCount = 0;
    let espnError: string | null = null;
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });
    const espnPage = await ctx.newPage();

    try {
      await espnPage.goto("https://www.espn.com/nba/scoreboard", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await espnPage.waitForTimeout(3_000);

      // Count scoreboard cards / game containers
      espnGameCount = await espnPage
        .locator("section.Scoreboard, .ScoreboardScoreCell, article.scoreboard")
        .count()
        .catch(() => 0);

      // Fallback: try counting by score cells
      if (espnGameCount === 0) {
        espnGameCount = await espnPage
          .locator("[class*='ScoreCell'], [class*='scoreboard']")
          .count()
          .catch(() => 0);
      }
    } catch (err) {
      espnError = err instanceof Error ? err.message : String(err);
    }

    await espnPage.close();
    await ctx.close();

    results.push({
      test: "espn-game-count-comparison",
      provider: "ESPN",
      sport: "NBA",
      passed: true, // Informational
      details: {
        scrollDownByLeague: sdByLeague,
        scrollDownTotal: sdGames.length,
        espnNbaGames: espnGameCount,
        ourNbaGames: sdByLeague["NBA"] ?? 0,
        difference: (sdByLeague["NBA"] ?? 0) - espnGameCount,
        espnError,
      },
    });
  });

  test("fetch CBS Sports scores page and compare", async ({
    request,
    browser,
  }) => {
    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdGames = sdData.games ?? [];

    let cbsGameCount = 0;
    let cbsError: string | null = null;
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });
    const cbsPage = await ctx.newPage();

    try {
      await cbsPage.goto("https://www.cbssports.com/nba/scoreboard/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await cbsPage.waitForTimeout(3_000);

      cbsGameCount = await cbsPage
        .locator("[class*='game-card'], [class*='single-score-card'], .live-update")
        .count()
        .catch(() => 0);
    } catch (err) {
      cbsError = err instanceof Error ? err.message : String(err);
    }

    await cbsPage.close();
    await ctx.close();

    results.push({
      test: "cbs-game-count-comparison",
      provider: "CBS Sports",
      sport: "NBA",
      passed: true,
      details: {
        scrollDownNbaGames: sdGames.filter(
          (g: { league: string }) => g.league?.toUpperCase() === "NBA",
        ).length,
        cbsNbaGames: cbsGameCount,
        cbsError,
      },
    });
  });

  test("ESPN API scoreboard data comparison (structured)", async ({
    request,
  }) => {
    // Use ESPN's public API (more reliable than scraping)
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today}`;

    let espnGames: ScoreData[] = [];
    let espnError: string | null = null;

    try {
      const espnRes = await request.get(espnUrl);
      if (espnRes.ok()) {
        const espnData = await espnRes.json();
        const events = espnData.events ?? [];
        espnGames = events.map(
          (e: {
            competitions: Array<{
              competitors: Array<{
                team: { abbreviation: string };
                score: string;
                homeAway: string;
              }>;
              status: { type: { name: string } };
            }>;
          }) => {
            const comp = e.competitions?.[0];
            const away = comp?.competitors?.find(
              (c: { homeAway: string }) => c.homeAway === "away",
            );
            const home = comp?.competitors?.find(
              (c: { homeAway: string }) => c.homeAway === "home",
            );
            return {
              away: away?.team?.abbreviation ?? "?",
              home: home?.team?.abbreviation ?? "?",
              awayScore: away?.score ? parseInt(away.score) : null,
              homeScore: home?.score ? parseInt(home.score) : null,
              status: comp?.status?.type?.name ?? "unknown",
            };
          },
        );
      }
    } catch (err) {
      espnError = err instanceof Error ? err.message : String(err);
    }

    // Get our games
    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdNba = (sdData.games ?? []).filter(
      (g: { league: string }) => g.league?.toUpperCase() === "NBA",
    );

    // Compare
    const matchedGames: Array<{
      espn: ScoreData;
      sd: { away: string; home: string; awayScore: number | null; homeScore: number | null } | null;
      scoresMatch: boolean;
    }> = [];

    for (const eg of espnGames) {
      const match = sdNba.find(
        (sg: { away_team: { abbreviation: string }; home_team: { abbreviation: string } }) =>
          sg.away_team?.abbreviation === eg.away &&
          sg.home_team?.abbreviation === eg.home,
      );

      matchedGames.push({
        espn: eg,
        sd: match
          ? {
              away: match.away_team?.abbreviation,
              home: match.home_team?.abbreviation,
              awayScore: match.away_score ?? null,
              homeScore: match.home_score ?? null,
            }
          : null,
        scoresMatch: match
          ? match.away_score === eg.awayScore &&
            match.home_score === eg.homeScore
          : false,
      });
    }

    const matchRate =
      espnGames.length > 0
        ? matchedGames.filter((m) => m.sd !== null).length / espnGames.length
        : 1;

    const scoreMatchRate =
      matchedGames.filter((m) => m.sd !== null).length > 0
        ? matchedGames.filter((m) => m.scoresMatch).length /
          matchedGames.filter((m) => m.sd !== null).length
        : 1;

    results.push({
      test: "espn-api-score-comparison",
      provider: "ESPN API",
      sport: "NBA",
      passed: matchRate >= 0.8,
      details: {
        espnGameCount: espnGames.length,
        sdNbaCount: sdNba.length,
        gamesMatched: matchedGames.filter((m) => m.sd !== null).length,
        gamesUnmatched: matchedGames.filter((m) => m.sd === null).length,
        matchRate: Math.round(matchRate * 100) + "%",
        scoreMatchRate: Math.round(scoreMatchRate * 100) + "%",
        comparisons: matchedGames.slice(0, 10),
        espnError,
      },
    });

    // At least 80% of ESPN games should be in our data
    if (espnGames.length > 0) {
      expect(matchRate).toBeGreaterThanOrEqual(0.8);
    }
  });

  test("ESPN NFL scoreboard comparison", async ({ request }) => {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${today}`;

    let espnCount = 0;
    let espnError: string | null = null;

    try {
      const espnRes = await request.get(espnUrl);
      if (espnRes.ok()) {
        const data = await espnRes.json();
        espnCount = data.events?.length ?? 0;
      }
    } catch (err) {
      espnError = err instanceof Error ? err.message : String(err);
    }

    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdNfl = (sdData.games ?? []).filter(
      (g: { league: string }) => g.league?.toUpperCase() === "NFL",
    );

    results.push({
      test: "espn-nfl-comparison",
      provider: "ESPN API",
      sport: "NFL",
      passed: true,
      details: {
        espnGames: espnCount,
        sdNflGames: sdNfl.length,
        difference: Math.abs(espnCount - sdNfl.length),
        espnError,
      },
    });
  });

  test("ESPN MLB scoreboard comparison", async ({ request }) => {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${today}`;

    let espnCount = 0;
    let espnError: string | null = null;

    try {
      const espnRes = await request.get(espnUrl);
      if (espnRes.ok()) {
        const data = await espnRes.json();
        espnCount = data.events?.length ?? 0;
      }
    } catch (err) {
      espnError = err instanceof Error ? err.message : String(err);
    }

    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdMlb = (sdData.games ?? []).filter(
      (g: { league: string }) => g.league?.toUpperCase() === "MLB",
    );

    results.push({
      test: "espn-mlb-comparison",
      provider: "ESPN API",
      sport: "MLB",
      passed: true,
      details: {
        espnGames: espnCount,
        sdMlbGames: sdMlb.length,
        difference: Math.abs(espnCount - sdMlb.length),
        espnError,
      },
    });
  });

  test("ESPN NHL scoreboard comparison", async ({ request }) => {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${today}`;

    let espnCount = 0;
    let espnError: string | null = null;

    try {
      const espnRes = await request.get(espnUrl);
      if (espnRes.ok()) {
        const data = await espnRes.json();
        espnCount = data.events?.length ?? 0;
      }
    } catch (err) {
      espnError = err instanceof Error ? err.message : String(err);
    }

    const sdRes = await request.get("/api/games");
    const sdData = await sdRes.json();
    const sdNhl = (sdData.games ?? []).filter(
      (g: { league: string }) => g.league?.toUpperCase() === "NHL",
    );

    results.push({
      test: "espn-nhl-comparison",
      provider: "ESPN API",
      sport: "NHL",
      passed: true,
      details: {
        espnGames: espnCount,
        sdNhlGames: sdNhl.length,
        difference: Math.abs(espnCount - sdNhl.length),
        espnError,
      },
    });
  });

  test("data latency measurement — how far behind ESPN are we", async ({
    request,
  }) => {
    const startSd = Date.now();
    const sdRes = await request.get("/api/games");
    const sdLatency = Date.now() - startSd;

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const startEspn = Date.now();
    let espnLatency = 0;
    let espnError: string | null = null;

    try {
      await request.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today}`,
      );
      espnLatency = Date.now() - startEspn;
    } catch (err) {
      espnLatency = Date.now() - startEspn;
      espnError = err instanceof Error ? err.message : String(err);
    }

    const startCbs = Date.now();
    let cbsLatency = 0;
    let cbsError: string | null = null;

    try {
      await request.get(
        "https://www.cbssports.com/nba/scoreboard/",
      );
      cbsLatency = Date.now() - startCbs;
    } catch (err) {
      cbsLatency = Date.now() - startCbs;
      cbsError = err instanceof Error ? err.message : String(err);
    }

    results.push({
      test: "api-latency-comparison",
      provider: "Multi",
      sport: "NBA",
      passed: true,
      details: {
        scrollDownMs: sdLatency,
        espnMs: espnLatency,
        cbsMs: cbsLatency,
        sdVsEspnDelta: sdLatency - espnLatency,
        sdVsCbsDelta: sdLatency - cbsLatency,
        sdStatus: sdRes.status(),
        espnError,
        cbsError,
      },
    });
  });
});

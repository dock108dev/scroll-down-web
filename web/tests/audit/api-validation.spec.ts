import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");
const MAX_RESPONSE_TIME_MS = 5_000;
// Health endpoint pings the backend admin API, which can be slow
const MAX_HEALTH_RESPONSE_TIME_MS = 10_000;

interface ApiTestResult {
  endpoint: string;
  method: string;
  status: number;
  responseTimeMs: number;
  validJson: boolean;
  hasExpectedShape: boolean;
  error?: string;
}

const GET_ENDPOINTS = [
  { path: "/api/health", shape: ["status", "timestamp"] },
  { path: "/api/games", shape: ["games"] },
  { path: "/api/golf/tournaments", shape: ["tournaments"] },
  { path: "/api/fairbet/odds", shape: ["bets"] },
  { path: "/api/fairbet/live/games", shape: [] },
  { path: "/api/analytics/models-list", shape: [] },
  { path: "/api/analytics/training-jobs", shape: [] },
  { path: "/api/analytics/batch-simulate-jobs", shape: [] },
  { path: "/api/analytics/calibration-report", shape: [] },
  { path: "/api/analytics/degradation-alerts", shape: [] },
  { path: "/api/analytics/mlb-teams", shape: [] },
  { path: "/api/analytics/mlb-data-coverage", shape: [] },
  { path: "/api/analytics/prediction-outcomes", shape: [] },
];

test.describe("Audit: API validation", () => {
  const results: ApiTestResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(RESULTS_DIR, "api-validation-results.json"),
      JSON.stringify(results, null, 2),
    );
  });

  for (const endpoint of GET_ENDPOINTS) {
    test(`GET ${endpoint.path} returns valid response`, async ({ request }) => {
      const start = Date.now();
      const res = await request.get(endpoint.path);
      const responseTimeMs = Date.now() - start;

      let body: Record<string, unknown> | null = null;
      let validJson = false;
      let hasExpectedShape = true;

      try {
        body = await res.json();
        validJson = true;
      } catch {
        validJson = false;
      }

      if (validJson && body && endpoint.shape.length > 0) {
        for (const key of endpoint.shape) {
          if (!(key in body)) {
            hasExpectedShape = false;
          }
        }
      }

      const result: ApiTestResult = {
        endpoint: endpoint.path,
        method: "GET",
        status: res.status(),
        responseTimeMs,
        validJson,
        hasExpectedShape,
      };
      results.push(result);

      // Assertions
      expect(res.status()).toBeLessThan(500);
      expect(validJson).toBe(true);
      const limit = endpoint.path === "/api/health" ? MAX_HEALTH_RESPONSE_TIME_MS : MAX_RESPONSE_TIME_MS;
      expect(responseTimeMs).toBeLessThan(limit);
      if (endpoint.shape.length > 0) {
        expect(hasExpectedShape).toBe(true);
      }
    });
  }

  test("dynamic game detail endpoint", async ({ request }) => {
    const gamesRes = await request.get("/api/games");
    if (!gamesRes.ok()) {
      test.skip(true, "Games API unavailable");
      return;
    }

    const gamesData = await gamesRes.json();
    const firstGame = gamesData.games?.[0];
    if (!firstGame) {
      test.skip(true, "No games available");
      return;
    }

    const start = Date.now();
    const res = await request.get(`/api/games/${firstGame.id}`);
    const responseTimeMs = Date.now() - start;

    const body = await res.json();
    const result: ApiTestResult = {
      endpoint: `/api/games/${firstGame.id}`,
      method: "GET",
      status: res.status(),
      responseTimeMs,
      validJson: true,
      hasExpectedShape: "game" in body,
    };
    results.push(result);

    expect(res.status()).toBe(200);
    expect(body.game).toBeTruthy();
    expect(responseTimeMs).toBeLessThan(MAX_RESPONSE_TIME_MS);
  });

  test("dynamic golf leaderboard endpoint", async ({ request }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }

    const tourData = await tourRes.json();
    const firstTour = tourData.tournaments?.[0];
    if (!firstTour) {
      test.skip(true, "No tournaments available");
      return;
    }

    const start = Date.now();
    const res = await request.get(
      `/api/golf/tournaments/${firstTour.event_id}/leaderboard`,
    );
    const responseTimeMs = Date.now() - start;

    const body = await res.json();
    const result: ApiTestResult = {
      endpoint: `/api/golf/tournaments/${firstTour.event_id}/leaderboard`,
      method: "GET",
      status: res.status(),
      responseTimeMs,
      validJson: true,
      hasExpectedShape: "leaderboard" in body,
    };
    results.push(result);

    expect(res.status()).toBe(200);
    expect(responseTimeMs).toBeLessThan(MAX_RESPONSE_TIME_MS);
  });
});

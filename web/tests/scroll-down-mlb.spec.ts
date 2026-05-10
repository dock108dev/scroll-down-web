/**
 * E2E coverage for the Scroll Down MLB BFF integration. The four
 * scenarios mandated by Phase 5: completed game, live game with banner,
 * deck-not-ready (409), and missing game (404).
 *
 * These tests use Playwright route-mocking against the BFF (`/api/games/...`)
 * because Phase 5 was developed without a running SDA instance + seeded
 * MLB data. Switching to a live stack only requires removing the
 * `page.route` calls — the assertions on the rendered UI stay the same.
 *
 * Tagged `@scroll-down-mlb` so the existing CI lanes can opt them in.
 */

import { test, expect } from "@playwright/test";
import type {
  SdmDeckResponse,
  SdmRecentResponse,
  SdmRevealResponse,
} from "../src/types/scroll-down-mlb";


// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------


function recentResponse(): SdmRecentResponse {
  return {
    games: [
      {
        gameId: "190121",
        league: "MLB",
        gameDate: "2026-05-03",
        status: "final",
        statusType: "final",
        awayTeam: {
          id: "1",
          abbreviation: "SF",
          displayName: "San Francisco Giants",
          colorLight: "#FD5A1E",
          colorDark: "#27251F",
        },
        homeTeam: {
          id: "2",
          abbreviation: "TB",
          displayName: "Tampa Bay Rays",
          colorLight: "#092C5C",
          colorDark: "#8FBCE6",
        },
        venueName: "Tropicana Field",
        startTime: "2026-05-03T17:40:00Z",
        hasDeck: true,
        deckVersion: "official-abc123",
        isFinal: true,
      },
    ],
  };
}


function deckResponse(version = "official-abc123", isFinal = true): SdmDeckResponse {
  return {
    gameId: "190121",
    deckVersion: version,
    generatedAt: "2026-05-03T20:13:52Z",
    isFinal,
    spoilerPolicy: "pre_reveal",
    homeTeam: {
      id: "2",
      abbreviation: "TB",
      displayName: "Tampa Bay Rays",
      colorLight: "#092C5C",
      colorDark: "#8FBCE6",
    },
    awayTeam: {
      id: "1",
      abbreviation: "SF",
      displayName: "San Francisco Giants",
      colorLight: "#FD5A1E",
      colorDark: "#27251F",
    },
    lastPlayIndex: 105074,
    firstPitch: "2026-05-03T17:40:00Z",
    venue: "Tropicana Field",
    homeProbablePitcher: null,
    awayProbablePitcher: null,
    cards: [
      {
        id: "190121-scene",
        type: "scene",
        sortOrder: 0,
        title: "First pitch",
        description: "Giants at Rays.",
      },
      {
        id: "190121-10002",
        type: "play",
        sortOrder: 1,
        inning: 1,
        half: "top",
        title: "Top 1st",
        description: "Schmitt singles home a run.",
        play: {
          playId: "10002",
          eventType: "single",
          label: "SINGLE",
          subLabel: "RUN SCORES",
          description: "Schmitt singles home a run.",
          batterName: "Casey Schmitt",
          pitcherName: null,
          ballsBefore: 1,
          strikesBefore: 2,
          outsBefore: 1,
          outsAfter: 1,
          baseStateBefore: { first: false, second: false, third: true },
          baseStateAfter: { first: true, second: false, third: false },
          runnerNamesBefore: { third: "Devers" },
          runnerNamesAfter: { first: "Schmitt" },
          scoreBefore: { home: 0, away: 0 },
          runsScoredOnPlay: 1,
        },
        visual: {
          trajectory: "fly_cf",
          runnerMovements: [],
          intensity: "medium",
          animationProfile: "shallow_fly",
        },
        leverageTier: 1,
      },
    ],
    plannerReport: { rhythm: [] },
    validationWarnings: [],
  };
}


function revealResponse(): SdmRevealResponse {
  return {
    gameId: "190121",
    finalScore: { home: 2, away: 1 },
    winnerTeamId: "2",
    summary: "Tampa Bay Rays beat San Francisco Giants, 2–1.",
    keyStats: [],
    gameFlow: [],
    generatedAt: "2026-05-03T20:30:00Z",
  };
}


// ---------------------------------------------------------------------------
// 1. Completed game
// ---------------------------------------------------------------------------


test("@scroll-down-mlb completed game: deck loads, no spoiler before reveal", async ({ page }) => {
  await page.route("**/api/games/recent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recentResponse()),
    });
  });
  await page.route("**/api/games/190121/cards", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(deckResponse()),
    });
  });
  await page.route("**/api/games/190121/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(revealResponse()),
    });
  });

  await page.goto("/");
  await page.locator("[data-testid='game-row-190121']").click();

  // Deck should be visible.
  await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();

  // Final-result text must NOT be in the DOM before the reveal gate.
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("Tampa Bay Rays beat");
  expect(bodyText).not.toMatch(/winner/i);

  // Reach the reveal gate, tap reveal.
  await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
  await page.locator("[data-testid='reveal-button']").click();

  // FinalReveal renders.
  await expect(page.locator("[data-testid='final-reveal']")).toBeVisible();
  await expect(page.locator("[data-testid='final-reveal']")).toContainText("Tampa Bay Rays beat");
});


// ---------------------------------------------------------------------------
// 2. Live game — banner appears on newer deckVersion, no auto-append
// ---------------------------------------------------------------------------


test("@scroll-down-mlb live game: banner gates deck updates", async ({ page }) => {
  let deckCallCount = 0;
  await page.route("**/api/games/recent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        games: [
          {
            ...recentResponse().games[0],
            isFinal: false,
            status: "live",
            statusType: "live",
            deckVersion: "live-v1",
          },
        ],
      } satisfies SdmRecentResponse),
    });
  });
  await page.route("**/api/games/190121/cards", async (route) => {
    deckCallCount += 1;
    // First call returns v1; subsequent calls return v2.
    const version = deckCallCount === 1 ? "live-v1" : "live-v2";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(deckResponse(version, false)),
    });
  });

  await page.goto("/");
  await page.locator("[data-testid='game-row-190121']").click();
  await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();

  // Banner should NOT be visible initially (v1 == v1).
  await expect(page.locator("[data-testid='new-moments-banner']")).not.toBeVisible();

  // Trigger a poll by advancing time. The hook polls on a fixed interval —
  // wait long enough for one cycle. The exact interval is in
  // `lib/config:POLLING.LIVE_CARDS_POLL_MS`. 30s is the typical default.
  await page.waitForTimeout(15_000);

  // After polling sees v2, the banner should appear without mutating
  // visible cards.
  await expect(page.locator("[data-testid='new-moments-banner']")).toBeVisible({ timeout: 35_000 });

  // Click "Update deck" — visible deck swaps.
  await page.locator("[data-testid='new-moments-banner'] button").click();
  await expect(page.locator("[data-testid='new-moments-banner']")).not.toBeVisible();
});


// ---------------------------------------------------------------------------
// 3. Deck not ready (404)
// ---------------------------------------------------------------------------


test("@scroll-down-mlb deck not ready: graceful empty state", async ({ page }) => {
  await page.route("**/api/games/recent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recentResponse()),
    });
  });
  await page.route("**/api/games/190121/cards", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No deck for this game yet." }),
    });
  });

  await page.goto("/catchup/190121");

  // Empty state, not a crash.
  await expect(page.locator(".catchup-empty, .catchup-error").first()).toBeVisible();
  await expect(page.locator("[data-testid='play-card']")).toHaveCount(0);
});


// ---------------------------------------------------------------------------
// 4. Reveal not ready (409)
// ---------------------------------------------------------------------------


test("@scroll-down-mlb reveal 409: shows pending message, no winner leak", async ({ page }) => {
  await page.route("**/api/games/recent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recentResponse()),
    });
  });
  await page.route("**/api/games/190121/cards", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(deckResponse()),
    });
  });
  await page.route("**/api/games/190121/summary", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Reveal not available yet for this game." }),
    });
  });

  await page.goto("/catchup/190121");
  await expect(page.locator("[data-testid='play-card']").first()).toBeVisible();
  await page.locator("[data-testid='reveal-button']").scrollIntoViewIfNeeded();
  await page.locator("[data-testid='reveal-button']").click();

  // Pending state surfaces; no winner badge or final score in the DOM.
  await expect(page.locator("[data-testid='final-reveal-pending']")).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("Rays beat");
  expect(text).not.toContain("Giants beat");
});

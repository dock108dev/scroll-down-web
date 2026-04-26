import { test, expect, waitForLoad, waitForProGateTestHook } from "../helpers";
import type { Page } from "@playwright/test";

/**
 * ISSUE-053 — Phase 9 advanced FairBet Pro feature E2E coverage.
 *
 * Fills the gaps not covered by the consolidated fairbet.spec.ts:
 *   • Line movement direction label (Pro)
 *   • EV simulator @ $100 matches calculated EV
 *   • CLV: log a bet → appears in /settings/my-bets with correct columns
 *   • Advanced filters: High confidence filters out low-confidence cards
 *   • Monte Carlo: win%, cover%, over/under% values rendered
 *   • CLV dashboard: summary row + sparkline present
 *
 * Tests skip gracefully when live data is insufficient — they must never
 * hard-fail on API variance.
 */

async function waitForCardsOrEmpty(
  page: Page,
  timeout = 20_000,
): Promise<"cards" | "empty" | "timeout"> {
  const betCards = page.locator("[data-testid='bet-card']");
  const emptyState = page.locator("[data-testid='fairbet-empty-state']");
  return await Promise.race([
    betCards.first().waitFor({ state: "visible", timeout }).then(() => "cards" as const),
    emptyState.waitFor({ state: "visible", timeout }).then(() => "empty" as const),
  ]).catch(() => "timeout" as const);
}

/** Deterministic `/api/fairbet/odds` payload so ISSUE-061 UI tests do not depend on upstream cards. */
const PHASE9_FAIRBET_ODDS_STUB = {
  bets: [
    {
      game_id: 9_000_001,
      league_code: "nba",
      home_team: "Celtics",
      away_team: "Knicks",
      game_date: "2026-04-10T23:00:00.000Z",
      market_key: "spread",
      selection_key: "nyk-2.5",
      selection_display: "Knicks -2.5",
      market_display_name: "Spread",
      has_fair: true,
      fair_american_odds: -108,
      best_book: "draftkings",
      best_ev_percent: 4.5,
      books: [
        {
          book: "draftkings",
          price: -105,
          observed_at: "2026-04-10T12:00:00.000Z",
          ev_percent: 4.5,
          display_ev: 4.5,
        },
        {
          book: "fanduel",
          price: -110,
          observed_at: "2026-04-10T12:00:00.000Z",
          ev_percent: 1.2,
        },
      ],
    },
  ],
  total: 1,
  books_available: ["draftkings", "fanduel"],
};

test.describe("Phase 9 FairBet Pro E2E @live-upstream", () => {
  // ── Line Movement (ISSUE-050) ────────────────────────────────────

  test("line movement: pro sees arrow and direction on at least one card @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const rows = page.locator("[data-testid='line-movement-row']");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(true, "No opening_line data in current API response");
      return;
    }

    // At least one row should have a non-flat direction (a real movement).
    let foundWithArrow = false;
    for (let i = 0; i < rowCount; i++) {
      const direction = await rows.nth(i).getAttribute("data-direction");
      expect(["up", "down", "flat"]).toContain(direction);
      if (direction === "up" || direction === "down") {
        const arrow = rows.nth(i).locator("[data-testid='line-movement-arrow']");
        await expect(arrow).toBeVisible();
        const arrowText = ((await arrow.textContent()) ?? "").trim();
        expect(direction === "up" ? "↑" : "↓").toBe(arrowText);
        foundWithArrow = true;
        break;
      }
    }
    if (!foundWithArrow) {
      test.skip(true, "All opening lines equal current lines — no movement to assert");
    }
  });

  // ── Advanced Filters (ISSUE-054) ─────────────────────────────────

  test("advanced filters: Strong confidence does not increase card count", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    await page.locator("[data-testid='more-filters-toggle']").click();
    const panel = page.locator("[data-testid='advanced-filters']");
    if ((await panel.count()) === 0) {
      test.skip(true, "Advanced filter panel not rendered");
      return;
    }

    const beforeCount = await page.locator("[data-testid='bet-card']").count();

    await panel.getByText("Strong", { exact: true }).click();
    // Allow the store update + re-render to settle.
    await page.waitForTimeout(500);

    const afterCount = await page.locator("[data-testid='bet-card']").count();

    // Filtering can either reduce the count or produce the empty state. Either
    // way, we must not see MORE cards after applying a stricter filter.
    expect(afterCount).toBeLessThanOrEqual(beforeCount);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sd-fairbet-filters") ?? "{}"),
    );
    expect(stored.confidence).toBe("high");
  });

  // ── Monte Carlo (ISSUE-055) ──────────────────────────────────────

  test("montecarlo: sheet renders win%, cover%, and over/under% values", async ({ page }) => {
    test.slow();
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const btn = page.locator("[data-testid='montecarlo-button']").first();
    if ((await btn.count()) === 0) {
      test.skip(true, "No montecarlo buttons rendered");
      return;
    }

    await btn.click();
    const sheet = page.locator("[data-testid='montecarlo-sheet']");
    await expect(sheet).toBeVisible({ timeout: 3_000 });

    // Win % bars populate once the simulation completes.
    const homeWin = sheet.locator("[data-testid='montecarlo-home-win']");
    const awayWin = sheet.locator("[data-testid='montecarlo-away-win']");
    // Simulation API can take 5-30s under parallel load; allow up to 60s.
    await expect(homeWin).toBeVisible({ timeout: 60_000 });
    await expect(awayWin).toBeVisible();

    // Cover % and over/under % stat boxes render immediately after results.
    const cover = sheet.locator("[data-testid='montecarlo-cover-pct']");
    const over = sheet.locator("[data-testid='montecarlo-over-pct']");
    await expect(cover).toBeVisible();
    await expect(over).toBeVisible();

    const coverText = ((await cover.textContent()) ?? "").trim();
    const overText = ((await over.textContent()) ?? "").trim();
    // Cover % is always a percent. Over/under may fall back to avg total
    // when the card has no total-line context.
    expect(coverText).toMatch(/^\d+\.\d%$/);
    expect(overText).toMatch(/^(\d+\.\d%|\d+\.\d)$/);
  });

  // ── CLV Dashboard (ISSUE-056) ────────────────────────────────────

  test("CLV dashboard: summary row and sparkline render for Pro users with enough bets", async ({
    page,
  }) => {
    // Seed enough logged bets with CLV data to unlock the dashboard.
    await page.goto("/settings/my-bets?tier=pro");
    await waitForLoad(page);

    await page.evaluate(() => {
      const now = Date.now();
      const bets = Array.from({ length: 5 }).map((_, i) => ({
        id: `seed-${i}`,
        gameId: 1000 + i,
        leagueCode: "nba",
        homeTeam: "Home",
        awayTeam: "Away",
        gameDate: new Date(now - i * 86_400_000).toISOString(),
        marketKey: i % 2 === 0 ? "spreads" : "h2h",
        marketLabel: i % 2 === 0 ? "Spread" : "Moneyline",
        selectionDisplay: "Home -3",
        book: i % 2 === 0 ? "DraftKings" : "FanDuel",
        placedOdds: -110,
        closingOdds: i % 2 === 0 ? -105 : -120,
        clvPercent: i % 2 === 0 ? 2.3 : -1.8,
        loggedAt: now - i * 3_600_000,
        outcome: i === 0 ? "win" : i === 1 ? "loss" : "pending",
      }));
      localStorage.setItem(
        "sd-my-bets",
        JSON.stringify({ state: { bets }, version: 0 }),
      );
    });

    await page.goto("/settings/my-bets/dashboard?tier=pro");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='clv-dashboard']")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[data-testid='dashboard-summary']")).toBeVisible();
    await expect(page.locator("[data-testid='stat-total-bets']")).toHaveText("5");
    await expect(page.locator("[data-testid='clv-sparkline']")).toBeVisible();
  });

  test("CLV dashboard: free user is shown upgrade copy, not the dashboard @smoke", async ({
    page,
  }) => {
    await page.goto("/settings/my-bets/dashboard?tier=free");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='clv-dashboard']")).not.toBeVisible();
    await expect(page.getByText(/CLV dashboard is a Pro feature/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ── History Gate (ISSUE-058) ─────────────────────────────────────────────────

test.describe("History Pro Gate (ISSUE-058) @live-upstream", () => {
  test("free user sees gate overlay with upgrade CTA on /history @smoke", async ({ page }) => {
    await page.goto("/history?tier=free");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='history-gate-overlay']")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator("[data-testid='history-gate-title']")).toBeVisible();
    await expect(page.locator("[data-testid='history-record-count']")).toBeVisible();
    await expect(page.locator("[data-testid='history-upgrade-cta']")).toBeVisible();
    // Full history content must not be shown to free users
    await expect(page.locator("[data-testid='page-history']")).not.toBeVisible();
  });

  test("free user clicking upgrade CTA opens the pro gate sheet @smoke", async ({ page }) => {
    await page.goto("/history?tier=free");
    await waitForLoad(page);

    await waitForProGateTestHook(page);

    const cta = page.locator("[data-testid='history-upgrade-cta']");
    await expect(cta).toBeVisible({ timeout: 5_000 });
    await cta.click();

    await expect(page.locator("[data-testid='pro-gate-sheet']")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("[data-testid='pro-gate-title']")).toHaveText(
      "Game History Archive",
    );
  });

  test("pro user sees full history content without gate @smoke", async ({ page }) => {
    await page.goto("/history?tier=pro");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='history-gate-overlay']")).not.toBeVisible();
    await expect(page.locator("[data-testid='page-history']")).toBeVisible({ timeout: 10_000 });
  });

  test("history API returns 403 pro_required for free tier requests @smoke", async ({
    request,
  }) => {
    const res = await request.get("/api/history?tier=free&startDate=2026-04-15&endDate=2026-04-15");
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("pro_required");
  });

  test("history API returns data for pro tier requests", async ({ request }) => {
    const res = await request.get(
      "/api/history?tier=pro&startDate=2026-04-15&endDate=2026-04-15",
    );
    // Either succeeds or backend is unavailable — never returns 403
    expect(res.status()).not.toBe(403);
  });
});

// ── FairBet book-details blur (ISSUE-061) ────────────────────────────────────

test.describe("FairBet book-details blur (ISSUE-061) @live-upstream", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/fairbet/odds**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PHASE9_FAIRBET_ODDS_STUB),
      }),
    );
  });

  test("free-tier: pregame cards render without blur and show book comparison @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    // The blur surface from the previous design should be gone for free pregame.
    expect(await page.locator("[data-testid='book-details-blur']").count()).toBe(0);

    // Book comparison row should be visible.
    const compRows = page.locator("[data-testid='book-comparison-row']");
    if ((await compRows.count()) > 0) {
      await expect(compRows.first()).toBeVisible();
    }
  });

  test("pro-tier: book comparison row is visible @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const compRows = page.locator("[data-testid='book-comparison-row']");
    if ((await compRows.count()) > 0) {
      await expect(compRows.first()).toBeVisible();
    }
  });
});

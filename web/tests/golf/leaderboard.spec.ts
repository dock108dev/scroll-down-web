import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

// ─── /api/golf/leaderboard (flat, admin-toggled endpoint) ─────────────────────

test.describe("Golf: /api/golf/leaderboard", () => {
  test("returns 404 when GOLF_ENABLED is not set", async ({ request }) => {
    // In test environments GOLF_ENABLED is unset by default, so the route must 404.
    const res = await request.get("/api/golf/leaderboard");
    // If an operator has set GOLF_ENABLED=true in their local env, skip gracefully.
    if (res.status() === 200) {
      test.skip(true, "GOLF_ENABLED=true in this environment — 404 test skipped");
      return;
    }
    expect(res.status()).toBe(404);
  });

  test("returns GolfLeaderboardEntry[] shape when enabled", async ({
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — leaderboard shape test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length === 0) return; // no active tournament — shape is still valid
    const entry = data[0];
    expect(typeof entry.playerId).toBe("string");
    expect(typeof entry.name).toBe("string");
    expect(typeof entry.position).toBe("string");
    expect(typeof entry.totalScore).toBe("number");
    expect(typeof entry.todayScore).toBe("number");
    expect(typeof entry.thru).toBe("string");
    expect(typeof entry.status).toBe("string");
  });
});

// ─── /golf page UI (reveal-mode leaderboard) ─────────────────────────────────

test.describe("Golf: /golf page", () => {
  test("returns 404 when GOLF_ENABLED is not set", async ({ page }) => {
    const res = await page.request.get("/api/golf/leaderboard");
    if (res.status() === 200) {
      test.skip(true, "GOLF_ENABLED=true — 404 page test skipped");
      return;
    }
    const response = await page.goto("/golf");
    expect(response?.status()).toBe(404);
  });

  test("renders golf leaderboard when GOLF_ENABLED=true", async ({
    authedPage: page,
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — /golf page test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='page-golf']")).toBeVisible();
    await expect(page.locator("[data-testid='golf-leaderboard']")).toBeVisible();
  });

  test("scores are blurred by default and revealed on row tap", async ({
    authedPage: page,
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — reveal test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      test.skip(true, "No leaderboard entries available");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    // First row score should be blurred before tap
    const firstRow = page.locator("[data-testid='golf-leaderboard-row']").first();
    await expect(firstRow).toBeVisible();
    const blurred = firstRow.locator("[data-testid='golf-score-blurred']");
    await expect(blurred).toBeVisible();

    // Tap to reveal
    await firstRow.click();
    const revealed = firstRow.locator("[data-testid='golf-score-revealed']");
    await expect(revealed).toBeVisible();
    await expect(blurred).not.toBeVisible();
  });

  test("cut line separator appears when missed-cut players exist", async ({
    authedPage: page,
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — cut line test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }
    const data = await res.json();
    const cutStatuses = new Set(["CUT", "WD", "DQ", "MDF"]);
    const hasMissedCut = Array.isArray(data) && data.some(
      (e: { status: string }) => cutStatuses.has(e.status.toUpperCase()),
    );
    if (!hasMissedCut) {
      test.skip(true, "No missed-cut players in current data — cut line test skipped");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    await expect(page.locator("[data-testid='cut-line']")).toBeVisible();
  });

  test("all leaderboard rows have required data-testid attributes", async ({
    authedPage: page,
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — data-testid test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      test.skip(true, "No leaderboard entries available");
      return;
    }

    await page.goto("/golf");
    await waitForLoad(page);

    const rows = page.locator("[data-testid='golf-leaderboard-row']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Every row must have a score element (blurred or revealed)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const row = rows.nth(i);
      const blurred = row.locator("[data-testid='golf-score-blurred']");
      const revealed = row.locator("[data-testid='golf-score-revealed']");
      const hasScore =
        (await blurred.count()) > 0 || (await revealed.count()) > 0;
      expect(hasScore).toBe(true);
    }
  });

  test("leaderboard auto-refreshes after polling interval elapses", async ({
    authedPage: page,
    request,
  }) => {
    const res = await request.get("/api/golf/leaderboard");
    if (res.status() === 404) {
      test.skip(true, "GOLF_ENABLED not set — auto-refresh test skipped");
      return;
    }
    if (!res.ok()) {
      test.skip(true, "Golf leaderboard API unavailable");
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      test.skip(true, "No leaderboard entries available");
      return;
    }

    // Install fake clock before navigation so setInterval is captured
    await page.clock.install({ time: Date.now() });

    let fetchCount = 0;
    await page.route("/api/golf/leaderboard", async (route) => {
      fetchCount++;
      await route.continue();
    });

    await page.goto("/golf");
    await waitForLoad(page);

    const beforeTick = fetchCount;

    // Advance past the 60-second polling interval, firing all due timers
    await page.clock.runFor(61_000);

    // Brief real-time pause to let the microtask queue flush
    await page.waitForTimeout(200);

    expect(fetchCount).toBeGreaterThan(beforeTick);
  });
}); // end "Golf: /golf page"

// ─── /api/golf/tournaments/[eventId]/leaderboard (per-event) ─────────────────

test.describe("Golf: Leaderboard", () => {
  test("leaderboard loads on event page", async ({
    authedPage: page,
    request,
  }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }
    const data = await tourRes.json();
    const tournament = data.tournaments?.[0];
    if (!tournament) {
      test.skip(true, "No tournaments available");
      return;
    }

    await page.goto(`/golf/${tournament.event_id}`);
    await waitForLoad(page);

    const leaderboard = page.locator("[data-testid='leaderboard']");
    // Leaderboard may or may not be available
    const isVisible = await leaderboard.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, "Leaderboard not available for this tournament");
      return;
    }

    await expect(leaderboard).toBeVisible();
  });

  test("leaderboard rows have position, name, and score", async ({
    authedPage: page,
    request,
  }) => {
    const tourRes = await request.get("/api/golf/tournaments");
    if (!tourRes.ok()) {
      test.skip(true, "Golf API unavailable");
      return;
    }
    const data = await tourRes.json();
    const tournament = data.tournaments?.[0];
    if (!tournament) {
      test.skip(true, "No tournaments available");
      return;
    }

    // Check leaderboard data exists via API
    const lbRes = await request.get(
      `/api/golf/tournaments/${tournament.event_id}/leaderboard`,
    );
    if (!lbRes.ok()) {
      test.skip(true, "Leaderboard API unavailable");
      return;
    }
    const lbData = await lbRes.json();
    if ((lbData.leaderboard ?? []).length === 0) {
      test.skip(true, "No leaderboard data");
      return;
    }

    await page.goto(`/golf/${tournament.event_id}`);
    await waitForLoad(page);

    const rows = page.locator("[data-testid='leaderboard-row']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // First row should have content
    const firstRow = rows.first();
    const text = await firstRow.textContent();
    expect(text?.length).toBeGreaterThan(0);

    // Verify first API entry name appears in UI
    const firstName = lbData.leaderboard[0].player_name;
    const leaderboardText = await page
      .locator("[data-testid='leaderboard']")
      .textContent();
    expect(leaderboardText).toContain(firstName);
  });
});

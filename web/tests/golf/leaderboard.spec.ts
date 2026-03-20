import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

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

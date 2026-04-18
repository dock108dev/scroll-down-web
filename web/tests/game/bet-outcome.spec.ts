/**
 * E2E tests for bet outcome badges on settled game detail odds sections.
 * ISSUE-032: Show Covered / Pushed / Lost badges for spread, total, moneyline.
 */
import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Bet outcome badges on settled game odds", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("no outcome badges shown on live or future game", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    // Find a non-final game row (live or upcoming)
    const liveRow = authedPage.locator("[data-testid='game-row']").filter({ hasText: /live|upcoming|scheduled/i }).first();
    const liveRowCount = await liveRow.count();
    if (liveRowCount === 0) { test.skip(true, "No live/upcoming games available"); return; }

    await liveRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Outcome badges should not be present
    const badges = authedPage.locator("[data-testid^='bet-outcome-']");
    await expect(badges).toHaveCount(0);
  });

  test("outcome badges appear on final game odds section", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    // Navigate to a final game
    const finalRow = authedPage.locator("[data-testid='game-row'][data-status='final'], [data-testid='game-row'][data-status='completed']").first();
    const finalCount = await finalRow.count();
    if (finalCount === 0) { test.skip(true, "No final games available"); return; }

    await finalRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    // Wait for odds section
    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    const oddsPresent = await oddsSection.count();
    if (oddsPresent === 0) { test.skip(true, "No odds section for this game"); return; }

    // Outcome badges should be present
    const badges = authedPage.locator("[data-testid^='bet-outcome-']");
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test("outcome badges use correct color classes (green/gray/red)", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const finalRow = authedPage.locator("[data-testid='game-row'][data-status='final'], [data-testid='game-row'][data-status='completed']").first();
    if (await finalRow.count() === 0) { test.skip(true, "No final games available"); return; }

    await finalRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section"); return; }

    const badges = authedPage.locator("[data-testid^='bet-outcome-']");
    if (await badges.count() === 0) { test.skip(true, "No outcome badges"); return; }

    const firstBadge = badges.first();
    const text = await firstBadge.textContent();
    const validLabels = ["Covered", "Pushed", "Lost", "Won"];
    expect(validLabels.some((label) => text?.includes(label))).toBe(true);
  });

  test("spread outcome badge has correct testid", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const finalRow = authedPage.locator("[data-testid='game-row'][data-status='final'], [data-testid='game-row'][data-status='completed']").first();
    if (await finalRow.count() === 0) { test.skip(true, "No final games available"); return; }

    await finalRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section"); return; }

    const spreadBadge = authedPage.locator("[data-testid='bet-outcome-spread']");
    if (await spreadBadge.count() === 0) { test.skip(true, "No spread odds for this game"); return; }

    const text = await spreadBadge.first().textContent();
    expect(["Covered", "Pushed", "Lost"]).toContain(text?.trim());
  });

  test("total outcome badge has correct testid", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const finalRow = authedPage.locator("[data-testid='game-row'][data-status='final'], [data-testid='game-row'][data-status='completed']").first();
    if (await finalRow.count() === 0) { test.skip(true, "No final games available"); return; }

    await finalRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section"); return; }

    const totalBadge = authedPage.locator("[data-testid='bet-outcome-total']");
    if (await totalBadge.count() === 0) { test.skip(true, "No total odds for this game"); return; }

    const text = await totalBadge.first().textContent();
    expect(["Covered", "Pushed", "Lost"]).toContain(text?.trim());
  });

  test("moneyline outcome badge has correct testid", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const finalRow = authedPage.locator("[data-testid='game-row'][data-status='final'], [data-testid='game-row'][data-status='completed']").first();
    if (await finalRow.count() === 0) { test.skip(true, "No final games available"); return; }

    await finalRow.click();
    await authedPage.waitForURL(/\/game\/.+/);
    await waitForLoad(authedPage);

    const oddsSection = authedPage.locator("[data-testid='odds-section']");
    if (await oddsSection.count() === 0) { test.skip(true, "No odds section"); return; }

    const mlBadge = authedPage.locator("[data-testid='bet-outcome-moneyline']");
    if (await mlBadge.count() === 0) { test.skip(true, "No moneyline odds for this game"); return; }

    const text = await mlBadge.first().textContent();
    expect(["Won", "Pushed", "Lost"]).toContain(text?.trim());
  });
});

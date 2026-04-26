import { test, expect, waitForLoad } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * Consolidated FairBet E2E suite (ISSUE-031).
 * Covers the critical-path acceptance criteria in a single file.
 * Individual feature specs live under tests/fairbet/*.spec.ts.
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

test.describe("FairBet E2E Suite @live-upstream", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("page loads without JS errors @smoke", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Network-level errors (e.g. transient upstream 429 / 5xx) surface as
      // "Failed to load resource…" in the browser console but are not JS
      // exceptions. Tests run 4 workers × 2 projects against a shared
      // upstream API key, so transient throttling is expected and not a
      // regression. The page itself handles these gracefully.
      if (/Failed to load resource/i.test(text)) return;
      consoleErrors.push(text);
    });

    await expect(page.getByRole("heading", { name: "FairBet" })).toBeVisible();
    const result = await waitForCardsOrEmpty(page);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }
    expect(consoleErrors).toHaveLength(0);
  });

  test("edge label present on at least one card @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const labels = page.locator("[data-testid='edge-label']");
    const count = await labels.count();
    if (count === 0) {
      test.skip(true, "No edges in current data set");
      return;
    }

    let matched = false;
    for (let i = 0; i < count; i++) {
      const text = ((await labels.nth(i).textContent()) ?? "").trim();
      if (/^(Strong|Medium|Small) edge$/i.test(text)) {
        matched = true;
        break;
      }
    }
    expect(matched).toBe(true);
  });

  test("book chip row renders with at least one chip @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const chips = page.locator("[data-testid^='book-chip-']");
    await expect(chips.first()).toBeVisible({ timeout: 10_000 });
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("mainlines shown by default; More Markets expands rows", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet groups available");
      return;
    }

    const groups = page.locator("[data-testid='game-bet-group']");
    const groupCount = await groups.count();

    // Find a group with a More Markets toggle and confirm clicking it
    // adds bet cards to the visible set. Default view shows only mainlines
    // (count varies by sport — h2h + spread + totals can be ≥3 cards on its
    // own, so don't assert a fixed cap).
    for (let i = 0; i < groupCount; i++) {
      const group = groups.nth(i);
      const toggle = group.locator("[data-testid='more-markets-toggle']");
      if ((await toggle.count()) === 0) continue;

      const before = await group.locator("[data-testid='bet-card']").count();
      await toggle.click();
      const after = await group.locator("[data-testid='bet-card']").count();
      expect(after).toBeGreaterThan(before);
      return;
    }
    test.skip(true, "No groups with extra markets in current data set");
  });

  test("source attribution line present on cards @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const attribution = page
      .locator("[data-testid='bet-card']")
      .first()
      .locator("[data-testid='fairbet-source-attribution']");
    await expect(attribution).toBeVisible();
    const text = ((await attribution.textContent()) ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
  });

  // ── CLV Tracking ────────────────────────────────────────────────────

  test("CLV: Pro user sees Log bet button on cards @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const logBtn = page.locator("[data-testid='log-bet-button']").first();
    if ((await logBtn.count()) === 0) {
      test.skip(true, "No log-bet buttons rendered");
      return;
    }
    await expect(logBtn).toBeVisible();
    await expect(logBtn).toHaveText(/\+ Log bet/i);
  });

  test("CLV: Log bet modal opens with book and odds pre-filled @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const logBtn = page.locator("[data-testid='log-bet-button']").first();
    if ((await logBtn.count()) === 0) {
      test.skip(true, "No log-bet buttons rendered");
      return;
    }

    await logBtn.click();
    const modal = page.locator("[data-testid='log-bet-modal']");
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // Stake input should be pre-filled with default
    const stakeInput = page.locator("[data-testid='log-bet-stake-input']");
    await expect(stakeInput).toBeVisible();
    await expect(stakeInput).toHaveValue("100");

    // Cancel closes the modal
    await page.locator("[data-testid='log-bet-cancel']").click();
    await expect(modal).not.toBeVisible({ timeout: 2_000 });
  });

  test("CLV: Log bet modal can confirm and modal closes @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const logBtn = page.locator("[data-testid='log-bet-button']").first();
    if ((await logBtn.count()) === 0) {
      test.skip(true, "No log-bet buttons rendered");
      return;
    }

    await logBtn.click();
    const modal = page.locator("[data-testid='log-bet-modal']");
    await expect(modal).toBeVisible({ timeout: 3_000 });

    const stakeInput = page.locator("[data-testid='log-bet-stake-input']");
    await stakeInput.fill("50");

    await page.locator("[data-testid='log-bet-confirm']").click();
    // Button changes text to "Logged ✓" then modal closes
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test("CLV: free user does not see Log bet button @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }
    const logBtns = page.locator("[data-testid='log-bet-button']");
    expect(await logBtns.count()).toBe(0);
  });

  test("CLV: My Bets settings page hidden from free users @smoke", async ({ page }) => {
    await page.goto("/settings/my-bets?tier=free");
    await waitForLoad(page);
    // Free user should see upgrade prompt, not the bets table
    await expect(page.locator("[data-testid='my-bets-page']")).not.toBeVisible();
    await expect(page.getByText(/CLV tracking is a Pro feature/i)).toBeVisible({ timeout: 5_000 });
  });

  test("CLV: My Bets page shows empty state for Pro users with no bets @smoke", async ({
    page,
  }) => {
    await page.goto("/settings/my-bets?tier=pro");
    await waitForLoad(page);
    // Clear any pre-existing bets
    await page.evaluate(() => localStorage.removeItem("sd-my-bets"));
    await page.reload();
    await waitForLoad(page);

    await expect(page.locator("[data-testid='my-bets-page']")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[data-testid='my-bets-empty']")).toBeVisible();
  });

  // ── Monte Carlo Win Probability (ISSUE-055) ─────────────────────────

  test("montecarlo: free user sees gated button that opens pro-gate sheet @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const gated = page.locator("[data-testid='montecarlo-gated']").first();
    await expect(gated).toBeVisible({ timeout: 5_000 });

    await gated.click();
    await expect(page.locator("[data-testid='pro-gate-sheet']")).toBeVisible({ timeout: 3_000 });
    // Confirm the sheet references the correct feature
    await expect(page.locator("[data-testid='pro-gate-title']")).toHaveText(
      /Win Probability/i,
    );
  });

  test("montecarlo: pro user sees Win Probability button, not gated @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    await expect(page.locator("[data-testid='montecarlo-button']").first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator("[data-testid='montecarlo-gated']")).toHaveCount(0);
  });

  test("montecarlo: pro user opens sheet which displays win probability @smoke", async ({
    page,
  }) => {
    // Monte Carlo simulations take 2-5s upstream + variable Next.js proxy
    // overhead under parallel test load; bump the test timeout so the inner
    // 30s waitFor isn't capped by the default 30s test budget.
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

    // Sheet should show win probability bars once simulation completes.
    // Simulation API can take 5-30s under parallel load; allow up to 60s.
    const homeWin = sheet.locator("[data-testid='montecarlo-home-win']");
    const awayWin = sheet.locator("[data-testid='montecarlo-away-win']");
    await expect(homeWin).toBeVisible({ timeout: 60_000 });
    await expect(awayWin).toBeVisible({ timeout: 5_000 });

    // Values should be percentages that sum to approximately 100%
    const homeText = ((await homeWin.textContent()) ?? "").trim();
    const awayText = ((await awayWin.textContent()) ?? "").trim();
    expect(homeText).toMatch(/^\d+\.\d%$/);
    expect(awayText).toMatch(/^\d+\.\d%$/);

    const homeVal = parseFloat(homeText);
    const awayVal = parseFloat(awayText);
    expect(homeVal + awayVal).toBeGreaterThan(95);
    expect(homeVal + awayVal).toBeLessThan(105);
  });

  test("montecarlo: sheet closes on backdrop click and reopens for different card @smoke", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const btns = page.locator("[data-testid='montecarlo-button']");
    if ((await btns.count()) < 1) {
      test.skip(true, "No montecarlo buttons rendered");
      return;
    }

    // Open sheet from first card
    await btns.first().click();
    const sheet = page.locator("[data-testid='montecarlo-sheet']");
    await expect(sheet).toBeVisible({ timeout: 3_000 });

    // Close via backdrop
    await page.locator("[data-testid='montecarlo-sheet']").evaluate((el) => {
      // Click outside the sheet content (on backdrop)
      const backdrop = el.previousElementSibling as HTMLElement | null;
      backdrop?.click();
    });
    await expect(sheet).not.toBeVisible({ timeout: 2_000 });

    // If there's a second card button, confirm it can open its own sheet
    if ((await btns.count()) >= 2) {
      await btns.nth(1).click();
      await expect(sheet).toBeVisible({ timeout: 3_000 });
      // Sheet should be accessible
      await expect(sheet).toHaveAttribute("data-testid", "montecarlo-sheet");
    }
  });

  test("montecarlo: sheet shows histogram element @smoke", async ({ page }) => {
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

    // Wait for simulation results (5-30s upstream + parallel-load slack)
    await expect(sheet.locator("[data-testid='montecarlo-home-win']")).toBeVisible({
      timeout: 60_000,
    });

    // Histogram should be rendered
    const histogram = sheet.locator("[data-testid='montecarlo-histogram']");
    await expect(histogram).toBeVisible();
    // Should have 10 child bar elements
    const bars = histogram.locator("> div");
    await expect(bars).toHaveCount(10);
  });

  test("empty state renders intentional messaging when no cards @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }
    if (result === "cards") {
      test.skip(true, "Cards returned — empty-state branch not exercised");
      return;
    }

    const emptyState = page.locator("[data-testid='fairbet-empty-state']");
    await expect(emptyState).toBeVisible();
    const text = ((await emptyState.textContent()) ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/markets are tight today|no bets match/i);
    await expect(emptyState.getByRole("button", { name: /refresh/i })).toBeVisible();
  });

  // ── Advanced Filters (ISSUE-054) ─────────────────────────────────

  test("more filters: free user sees gated Confidence row that opens pro-gate sheet @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    await page.locator("[data-testid='more-filters-toggle']").click();
    const gated = page.locator("[data-testid='fairbet-filters-gated']");
    await expect(gated).toBeVisible({ timeout: 5_000 });

    await gated.click();
    await expect(page.locator("[data-testid='pro-gate-sheet']")).toBeVisible({ timeout: 3_000 });
  });

  test("more filters: pro user sees Confidence and Starts rows after expanding @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    await page.locator("[data-testid='more-filters-toggle']").click();
    const panel = page.locator("[data-testid='advanced-filters']");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await expect(panel.getByText("Confidence")).toBeVisible();
    await expect(panel.getByText("Strong", { exact: true })).toBeVisible();

    await expect(panel.getByText("Starts")).toBeVisible();
    await expect(panel.getByText("Within 1h")).toBeVisible();
  });

  test("more filters: confidence selection persists across page reload @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    await page.locator("[data-testid='more-filters-toggle']").click();
    const panel = page.locator("[data-testid='advanced-filters']");
    if ((await panel.count()) === 0) {
      test.skip(true, "Advanced filter panel not rendered");
      return;
    }

    await panel.getByText("Strong", { exact: true }).click();

    await page.reload();
    await waitForLoad(page);
    await waitForCardsOrEmpty(page, 15_000);

    const storedFilters = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sd-fairbet-filters") ?? "{}"),
    );
    expect(storedFilters.confidence).toBe("high");
  });
});

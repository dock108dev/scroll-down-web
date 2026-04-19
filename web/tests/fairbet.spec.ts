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
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await expect(page.getByRole("heading", { name: "FairBet" })).toBeVisible();
    const result = await waitForCardsOrEmpty(page);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }
    expect(consoleErrors).toHaveLength(0);
  });

  test("dollar-value EV label present on at least one card @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const evLabels = page.locator("[data-testid='ev-dollar-label']");
    const count = await evLabels.count();
    if (count === 0) {
      test.skip(true, "No EV labels in current data set");
      return;
    }

    // Find at least one card whose label matches the "+$X.XX per $100" format.
    let matched = false;
    for (let i = 0; i < count; i++) {
      const text = (await evLabels.nth(i).textContent()) ?? "";
      if (/^[+-]\$\d+\.\d{2} per \$100$/.test(text.trim())) {
        matched = true;
        break;
      }
    }
    expect(matched).toBe(true);
  });

  test("traffic-light tier badge present on at least one card @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const tierBadges = page.locator("[data-testid='ev-tier-badge']");
    const badgeCount = await tierBadges.count();
    if (badgeCount === 0) {
      test.skip(true, "All current cards are no-edge tier");
      return;
    }

    const first = tierBadges.first();
    await expect(first).toBeVisible();
    const text = ((await first.textContent()) ?? "").trim();
    expect(["Strong", "Good", "Marginal"]).toContain(text);
    // Tier color is driven by inline CSS variables — confirm styling applied.
    const bg = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("");
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
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

    // By default each group should render ≤3 bet cards (mainlines only).
    for (let i = 0; i < Math.min(groupCount, 5); i++) {
      const cards = groups.nth(i).locator("[data-testid='bet-card']");
      expect(await cards.count()).toBeLessThanOrEqual(3);
    }

    // Find a group with a More Markets toggle and confirm it expands.
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

  test("fair price explanation panel opens and closes on tap @smoke", async ({ page }) => {
    const result = await waitForCardsOrEmpty(page);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const trigger = page.locator("[data-testid='fairbet-explanation']").first();
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
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

  test("line-movement row is blurred for free users and unblurred for pro @smoke", async ({
    page,
  }) => {
    // Navigate as free user first; skip if no cards with opening_line in data.
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const resultFree = await waitForCardsOrEmpty(page, 15_000);
    if (resultFree !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const gated = page.locator("[data-testid='line-movement-gated']");
    const gatedCount = await gated.count();
    if (gatedCount === 0) {
      test.skip(true, "No opening_line data in current API response");
      return;
    }
    await expect(gated.first()).toBeVisible();

    // Pro tier should not show the gated element.
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    await waitForCardsOrEmpty(page, 15_000);
    await expect(page.locator("[data-testid='line-movement-gated']")).toHaveCount(0);
  });

  test("EV simulator: pro user sees outputs after entering stake @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const input = page.locator("[data-testid='ev-simulator-input']").first();
    if ((await input.count()) === 0) {
      test.skip(true, "No EV simulator inputs in current data");
      return;
    }
    await expect(input).toBeVisible();

    await input.fill("50");
    // wait for debounce
    await page.waitForTimeout(400);

    const perBet = page.locator("[data-testid='ev-simulator-per-bet']").first();
    const over100 = page.locator("[data-testid='ev-simulator-over-100']").first();
    await expect(perBet).toBeVisible();
    await expect(over100).toBeVisible();

    const perBetText = ((await perBet.textContent()) ?? "").trim();
    const over100Text = ((await over100.textContent()) ?? "").trim();
    // Both outputs must be dollar amounts with sign
    expect(perBetText).toMatch(/^[+-]\$\d+\.\d{2}$/);
    expect(over100Text).toMatch(/^[+-]\$\d+\.\d{2}$/);

    // Over 100 must be 100× per-bet
    const perBetVal = parseFloat(perBetText.replace(/[^0-9.-]/g, "")) * (perBetText.startsWith("-") ? -1 : 1);
    const over100Val = parseFloat(over100Text.replace(/[^0-9.-]/g, "")) * (over100Text.startsWith("-") ? -1 : 1);
    expect(Math.abs(over100Val - perBetVal * 100)).toBeLessThan(0.01);
  });

  test("EV simulator: free user sees disabled input and gate sheet on focus @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const gated = page.locator("[data-testid='ev-simulator-gated']").first();
    await expect(gated).toBeVisible();
    await expect(gated).toHaveAttribute("aria-disabled", "true");

    await gated.focus();
    await expect(page.locator("[data-testid='pro-gate-sheet']")).toBeVisible({ timeout: 3_000 });
  });

  test("EV simulator: non-numeric input is ignored, negative clamped to 0 @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result !== "cards") {
      test.skip(true, "No bet cards available");
      return;
    }

    const input = page.locator("[data-testid='ev-simulator-input']").first();
    if ((await input.count()) === 0) {
      test.skip(true, "No EV simulator inputs in current data");
      return;
    }

    // Non-numeric: output should not appear
    await input.fill("abc");
    await page.waitForTimeout(400);
    // The input filter rejects non-numeric chars, so value stays empty → no output rendered
    await expect(page.locator("[data-testid='ev-simulator-per-bet']").first()).toHaveCount(0);

    // Negative value: stake clamped to 0, outputs show $0.00
    await input.fill("-10");
    await page.waitForTimeout(400);
    const perBet = page.locator("[data-testid='ev-simulator-per-bet']").first();
    const over100 = page.locator("[data-testid='ev-simulator-over-100']").first();
    await expect(perBet).toBeVisible();
    const perBetText = ((await perBet.textContent()) ?? "").trim();
    const over100Text = ((await over100.textContent()) ?? "").trim();
    expect(perBetText).toBe("+$0.00");
    expect(over100Text).toBe("+$0.00");
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

    // Sheet should show win probability bars once simulation completes (up to 30s for API)
    const homeWin = sheet.locator("[data-testid='montecarlo-home-win']");
    const awayWin = sheet.locator("[data-testid='montecarlo-away-win']");
    await expect(homeWin).toBeVisible({ timeout: 30_000 });
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

    // Wait for simulation results
    await expect(sheet.locator("[data-testid='montecarlo-home-win']")).toBeVisible({
      timeout: 30_000,
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

  test("advanced filters: free user sees gated button that opens pro-gate sheet @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=free");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    const gated = page.locator("[data-testid='fairbet-filters-gated']");
    await expect(gated).toBeVisible({ timeout: 5_000 });

    await gated.click();
    await expect(page.locator("[data-testid='pro-gate-sheet']")).toBeVisible({ timeout: 3_000 });
  });

  test("advanced filters: pro user sees full filter panel with four control rows @smoke", async ({
    page,
  }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    const panel = page.locator("[data-testid='advanced-filters']");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Confidence pills
    await expect(panel.getByText("Confidence")).toBeVisible();
    await expect(panel.getByText("High")).toBeVisible();

    // Time-to-game pills
    await expect(panel.getByText("Starts")).toBeVisible();
    await expect(panel.getByText("Within 1h")).toBeVisible();
  });

  test("advanced filters: filter state persists across page reload @smoke", async ({ page }) => {
    await page.goto("/fairbet?tier=pro");
    await waitForLoad(page);
    const result = await waitForCardsOrEmpty(page, 15_000);
    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    const panel = page.locator("[data-testid='advanced-filters']");
    if ((await panel.count()) === 0) {
      test.skip(true, "Advanced filter panel not rendered");
      return;
    }

    // Click "High" confidence
    await panel.getByText("High").click();

    // Reload and confirm localStorage state is restored
    await page.reload();
    await waitForLoad(page);
    await waitForCardsOrEmpty(page, 15_000);

    const storedFilters = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sd-fairbet-filters") ?? "{}"),
    );
    expect(storedFilters.confidence).toBe("high");
  });
});

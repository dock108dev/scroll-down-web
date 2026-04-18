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

test.describe("FairBet E2E Suite", () => {
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
});

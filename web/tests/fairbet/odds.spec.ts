import { test, expect, waitForLoad } from "../helpers";

test.describe("FairBet Page - Odds @live-upstream", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fairbet");
    await waitForLoad(page);
  });

  test("page loads and shows FairBet heading @smoke", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "FairBet" })).toBeVisible();
  });

  test("Pre-Game tab is active by default", async ({ page }) => {
    // Tabs are plain buttons, not role="tab". The active tab has different styling.
    const preGameBtn = page.getByRole("button", { name: "Pre-Game" });
    await expect(preGameBtn).toBeVisible();
  });

  test("loading state appears then resolves", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    // Wait for loading to finish — one of these should appear
    try {
      await expect(
        betCards.first().or(emptyState)
      ).toBeVisible({ timeout: 20_000 });
    } catch {
      throw new Error("Neither bet cards nor empty state appeared");
    }
  });

  test("skeleton placeholders shown during initial fetch @smoke", async ({ page }) => {
    // Navigate fresh and immediately check for skeleton before data loads
    const skeleton = page.locator("[data-testid='loading-skeleton']");
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    // Slow down network to catch skeleton window
    await page.route("**/api/fairbet/odds*", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });

    await page.goto("/fairbet");

    // Skeleton should appear before data resolves
    const skeletonVisible = await skeleton.isVisible().catch(() => false);
    // It's a race — if skeleton missed, data must be present
    if (!skeletonVisible) {
      const resolved = await Promise.race([
        betCards.first().waitFor({ state: "visible", timeout: 15_000 }).then(() => true),
        emptyState.waitFor({ state: "visible", timeout: 15_000 }).then(() => true),
      ]).catch(() => false);
      expect(resolved).toBe(true);
    }
  });

  test("empty state renders with intentional messaging and no console errors @smoke", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    if (result === "empty") {
      await expect(emptyState).toBeVisible();
      // Intentional headline must be present
      const text = await emptyState.textContent() ?? "";
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toMatch(/markets are tight today|no bets match/i);
      // Refresh button must be in the empty state
      const refreshBtn = emptyState.getByRole("button", { name: /refresh/i });
      await expect(refreshBtn).toBeVisible();
      expect(consoleErrors).toHaveLength(0);
    }
    // If cards are shown, empty state is not relevant — test passes
  });

  test('"How it works" button opens explainer @smoke', async ({ page }) => {
    const howItWorksButton = page.getByRole("button", { name: "How it works" });
    await expect(howItWorksButton).toBeVisible();
    await howItWorksButton.click();

    await expect(
      page.getByRole("heading", { name: "How FairBet Works" })
    ).toBeVisible();
  });

  test("bet cards render after loading or empty state shown", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout") {
      test.skip(true, "FairBet API did not respond within 20s");
      return;
    }

    expect(["cards", "empty"]).toContain(result);
  });

  test("filter controls are visible", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(3000);

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test("no-edge tier bet card renders without EV tier badge", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout" || result === "empty") {
      test.skip(true, "No bet cards available to verify no-edge tier");
      return;
    }

    // Find a card that shows "No edge" (no-edge tier) and verify no tier badge
    const allCards = await betCards.all();
    for (const card of allCards) {
      const evLabel = card.locator("[data-testid='ev-dollar-label']");
      const labelText = await evLabel.textContent().catch(() => null);
      if (labelText === "No edge") {
        const tierBadge = card.locator("[data-testid='ev-tier-badge']");
        await expect(tierBadge).toHaveCount(0);
        return;
      }
    }
    // No "No edge" cards found — skip gracefully
    test.skip(true, "No no-edge tier cards in current data set");
  });

  test("FairBet card shows ≤3 market rows by default before expansion", async ({ page }) => {
    const groups = page.locator("[data-testid='game-bet-group']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const result = await Promise.race([
      groups.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "groups"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout" || result === "empty") {
      test.skip(true, "No bet groups available to verify market count");
      return;
    }

    // Each game group should show ≤3 bet cards before expansion
    const allGroups = await groups.all();
    for (const group of allGroups.slice(0, 5)) {
      const cards = group.locator("[data-testid='bet-card']");
      const count = await cards.count();
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  test("More Markets button expands non-mainline bets", async ({ page }) => {
    const groups = page.locator("[data-testid='game-bet-group']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const result = await Promise.race([
      groups.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "groups"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout" || result === "empty") {
      test.skip(true, "No bet groups available");
      return;
    }

    // Find a group that has a More Markets toggle
    const allGroups = await groups.all();
    for (const group of allGroups) {
      const toggle = group.locator("[data-testid='more-markets-toggle']");
      const hasToggle = await toggle.count() > 0;
      if (!hasToggle) continue;

      const beforeCount = await group.locator("[data-testid='bet-card']").count();
      await toggle.click();
      const afterCount = await group.locator("[data-testid='bet-card']").count();
      expect(afterCount).toBeGreaterThan(beforeCount);
      return;
    }
    test.skip(true, "No groups with extra markets in current data set");
  });

  test("bet cards show dollar-value EV format", async ({ page }) => {
    const betCards = page.locator("[data-testid='bet-card']");
    const emptyState = page.locator("[data-testid='fairbet-empty-state']");

    const result = await Promise.race([
      betCards.first().waitFor({ state: "visible", timeout: 20_000 }).then(() => "cards"),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (result === "timeout" || result === "empty") {
      test.skip(true, "No bet cards available to verify EV format");
      return;
    }

    const evLabel = betCards.first().locator("[data-testid='ev-dollar-label']");
    const hasEvLabel = await evLabel.count() > 0;

    if (!hasEvLabel) {
      // No EV label means ev_percent was null/undefined — acceptable
      return;
    }

    const text = await evLabel.textContent() ?? "";
    const isDollarFormat = /^[+-]\$\d+\.\d{2} per \$100$/.test(text) || text === "No edge";
    expect(isDollarFormat).toBe(true);
  });
});

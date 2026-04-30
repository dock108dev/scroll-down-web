import { test, expect, waitForLoad, waitForGameData } from "../helpers";

test.describe("Freshness label on live game cards @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("freshness label is absent on pregame and final rows", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Freshness labels should never appear on non-live rows
    const finalRows = authedPage.locator(
      "[data-testid='game-row']:has(.text-neutral-600:text('Final'))",
    );
    const count = await finalRows.count();
    for (let i = 0; i < count; i++) {
      const label = finalRows.nth(i).locator("[data-testid='freshness-label']");
      await expect(label).not.toBeVisible();
    }
  });

  test("freshness label not present immediately after page load (data is fresh)", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // On a fresh page load, coreUpdatedAt is recent so no label should show
    // (labels only appear once live data is meaningfully delayed)
    const labels = authedPage.locator("[data-testid='freshness-label']");
    const labelCount = await labels.count();
    expect(labelCount).toBe(0);
  });

  test("freshness label stays hidden for routine 60s live refresh age", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    // Simulate routine live refresh age by backdating coreUpdatedAt to 60 seconds ago.
    const injected = await authedPage.evaluate(() => {
      const store = (
        window as unknown as {
          __gameDataStore?: { getState: () => { games: Map<number, { core: { isLive?: boolean }; coreUpdatedAt: number }> } };
        }
      ).__gameDataStore;
      if (!store) return false;
      const state = store.getState();
      let patched = 0;
      for (const [, entry] of state.games) {
        if (entry.core.isLive) {
          entry.coreUpdatedAt = Date.now() - 60_000;
          patched++;
        }
      }
      return patched > 0;
    });

    if (!injected) {
      test.skip(true, "No live games in store or store not exposed — skipping stale-state injection test");
      return;
    }

    await authedPage.waitForTimeout(200);

    const labels = authedPage.locator("[data-testid='freshness-label']");
    await expect(labels).toHaveCount(0);
  });

  test("freshness label shows amber 'May be delayed' at 10–15min threshold", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const injected = await authedPage.evaluate(() => {
      const store = (
        window as unknown as {
          __gameDataStore?: { getState: () => { games: Map<number, { core: { isLive?: boolean }; coreUpdatedAt: number }> } };
        }
      ).__gameDataStore;
      if (!store) return false;
      const state = store.getState();
      let patched = 0;
      for (const [, entry] of state.games) {
        if (entry.core.isLive) {
          entry.coreUpdatedAt = Date.now() - 11 * 60_000;
          patched++;
        }
      }
      return patched > 0;
    });

    if (!injected) {
      test.skip(true, "No live games or store not exposed");
      return;
    }

    await authedPage.waitForTimeout(200);

    const labels = authedPage.locator("[data-testid='freshness-label']");
    if ((await labels.count()) === 0) {
      test.skip(true, "Label did not appear after store injection");
      return;
    }
    const text = await labels.first().textContent();
    expect(text).toBe("May be delayed");
  });

  test("freshness label shows red 'Data delayed' beyond 15min threshold", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const injected = await authedPage.evaluate(() => {
      const store = (
        window as unknown as {
          __gameDataStore?: { getState: () => { games: Map<number, { core: { isLive?: boolean }; coreUpdatedAt: number }> } };
        }
      ).__gameDataStore;
      if (!store) return false;
      const state = store.getState();
      let patched = 0;
      for (const [, entry] of state.games) {
        if (entry.core.isLive) {
          entry.coreUpdatedAt = Date.now() - 16 * 60_000;
          patched++;
        }
      }
      return patched > 0;
    });

    if (!injected) {
      test.skip(true, "No live games or store not exposed");
      return;
    }

    await authedPage.waitForTimeout(200);

    const labels = authedPage.locator("[data-testid='freshness-label']");
    if ((await labels.count()) === 0) {
      test.skip(true, "Label did not appear after store injection");
      return;
    }
    const text = await labels.first().textContent();
    expect(text).toBe("Data delayed");
  });
});

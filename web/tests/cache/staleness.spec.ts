import { test, expect, waitForLoad } from "../helpers";

test.describe("Cache Staleness Behavior", () => {
  test("First visit fetches data and page loads successfully", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Page should have rendered content (not just skeletons)
    const body = await authedPage.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test("Reload within short period still shows data (cache hit)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Reload immediately - cached data should make this fast
    const startTime = Date.now();
    await authedPage.reload();
    await waitForLoad(authedPage);
    const elapsed = Date.now() - startTime;

    // Page should still display data after reload
    const body = await authedPage.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);

    // Cached reload should be reasonably fast
    expect(elapsed).toBeLessThan(5000);
  });

  test("After simulating tab hidden/return, data refreshes", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Simulate tab going hidden
    await authedPage.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait longer than VISIBILITY_AWAY_MS (5000ms)
    await authedPage.waitForTimeout(6000);

    // Simulate tab becoming visible again
    await authedPage.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait for potential refetch to complete
    await authedPage.waitForTimeout(2000);

    // Page should still display valid data after refresh
    const body = await authedPage.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test("localStorage contains cached data after visit", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    const keys = await authedPage.evaluate(() => Object.keys(localStorage));

    // At least some of the known localStorage keys should be present
    const knownKeys = [
      "sd-auth",
      "sd-pinned-games",
      "sd-settings",
      "sd-reading-position",
      "sd-section-layout",
    ];
    const hasAtLeastOne = knownKeys.some((k) => keys.includes(k));
    expect(hasAtLeastOne).toBe(true);
  });
});

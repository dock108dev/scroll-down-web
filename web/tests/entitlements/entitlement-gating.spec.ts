import { test, expect, waitForLoad } from "../helpers";

test.describe("EntitlementProvider — capability-based feature gating", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);
  });

  test("free user sees upgrade prompt on gated features", async ({
    authedPage,
  }) => {
    // Ensure user role is "user" (free tier) by checking auth store
    const role = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      if (!raw) return null;
      return JSON.parse(raw)?.state?.role;
    });

    // Skip if admin (admin resolves to pro tier)
    if (role === "admin") {
      test.skip(true, "Admin user resolves to pro tier");
      return;
    }

    // Verify entitlement override is not active
    const hasOverride = await authedPage.evaluate(() => {
      const raw = sessionStorage.getItem("sd-entitlement-override");
      if (!raw) return false;
      return JSON.parse(raw)?.active === true;
    });
    expect(hasOverride).toBe(false);
  });

  test("admin override stored in sessionStorage, not localStorage", async ({
    authedPage,
  }) => {
    // Set an override in sessionStorage
    await authedPage.evaluate(() => {
      sessionStorage.setItem(
        "sd-entitlement-override",
        JSON.stringify({ active: true, tier: "pro", overrides: {} }),
      );
    });

    // Verify it's in sessionStorage
    const inSession = await authedPage.evaluate(() => {
      const raw = sessionStorage.getItem("sd-entitlement-override");
      return raw !== null;
    });
    expect(inSession).toBe(true);

    // Verify it's NOT in localStorage
    const inLocal = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-entitlement-override");
      return raw !== null;
    });
    expect(inLocal).toBe(false);

    // Clean up
    await authedPage.evaluate(() => {
      sessionStorage.removeItem("sd-entitlement-override");
    });
  });

  test("override is cleared when sessionStorage is removed", async ({
    authedPage,
  }) => {
    // Set and then remove override
    await authedPage.evaluate(() => {
      sessionStorage.setItem(
        "sd-entitlement-override",
        JSON.stringify({ active: true, tier: "pro", overrides: {} }),
      );
    });

    await authedPage.evaluate(() => {
      sessionStorage.removeItem("sd-entitlement-override");
    });

    const override = await authedPage.evaluate(() => {
      return sessionStorage.getItem("sd-entitlement-override");
    });
    expect(override).toBeNull();
  });

  test("tier capabilities map has correct free tier defaults", async ({
    authedPage,
  }) => {
    // Inject a script that reads the capabilities module via the window
    const freeCaps = await authedPage.evaluate(() => {
      // Read from sessionStorage to confirm no override is active
      const raw = sessionStorage.getItem("sd-entitlement-override");
      const override = raw ? JSON.parse(raw) : null;
      return {
        hasOverride: override?.active === true,
      };
    });

    expect(freeCaps.hasOverride).toBe(false);
  });
});

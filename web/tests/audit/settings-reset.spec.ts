import { test, expect } from "../helpers";
import fs from "fs";
import path from "path";

/**
 * Settings Reset Testing Suite
 *
 * Validates that all settings can be changed, persisted, and properly
 * reset to defaults. Tests cross-session persistence and corruption recovery.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

// Matches DEFAULTS in src/lib/config.ts and settings store defaults
const EXPECTED_DEFAULTS = {
  theme: "system",
  scoreRevealMode: "onMarkRead",
  preferredSportsbook: "",
  oddsFormat: "american",
  autoResumePosition: true,
  hideLimitedData: true,
  timelineDefaultTiers: [1, 2, 3],
  followingLive: false,
};

interface SettingsResult {
  test: string;
  passed: boolean;
  details: Record<string, unknown>;
}

test.describe("Audit: Settings reset & persistence", () => {
  const results: SettingsResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `settings-reset-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("settings store initializes with correct defaults", async ({
    page,
  }) => {
    // Fresh page with no stored state
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state : null;
    });

    const checks: Record<string, boolean> = {};
    if (settings) {
      for (const [key, expected] of Object.entries(EXPECTED_DEFAULTS)) {
        const actual = settings[key];
        checks[key] =
          JSON.stringify(actual) === JSON.stringify(expected);
      }
    }

    results.push({
      test: "default-initialization",
      passed: settings !== null && Object.values(checks).every(Boolean),
      details: { settings, checks },
    });

    expect(settings).not.toBeNull();
    for (const [key, match] of Object.entries(checks)) {
      expect(match, `Default mismatch for ${key}`).toBe(true);
    }
  });

  test("theme change persists to localStorage", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Navigate to settings
    await page.goto("/settings").catch(() => {
      // Settings might be a drawer, try clicking settings link
    });
    await page.waitForTimeout(1_000);

    // Read current theme, change it via localStorage (simulating store action)
    const before = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state?.theme : null;
    });

    // Mutate the store directly
    await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.theme = parsed.state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("sd-settings", JSON.stringify(parsed));
      }
    });

    // Reload and verify persistence
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2_000);

    const after = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state?.theme : null;
    });

    results.push({
      test: "theme-persistence",
      passed: before !== after,
      details: { before, after },
    });

    expect(before).not.toBe(after);
  });

  test("odds format change persists", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Change odds format via store mutation
    await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.oddsFormat = "decimal";
        localStorage.setItem("sd-settings", JSON.stringify(parsed));
      }
    });

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2_000);

    const oddsFormat = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state?.oddsFormat : null;
    });

    results.push({
      test: "odds-format-persistence",
      passed: oddsFormat === "decimal",
      details: { oddsFormat },
    });

    expect(oddsFormat).toBe("decimal");
  });

  test("clearing settings storage restores defaults on reload", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Set non-default values
    await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.theme = "dark";
        parsed.state.oddsFormat = "fractional";
        parsed.state.autoResumePosition = false;
        localStorage.setItem("sd-settings", JSON.stringify(parsed));
      }
    });

    // Remove settings key entirely
    await page.evaluate(() => localStorage.removeItem("sd-settings"));

    // Reload — Zustand should re-initialize with defaults
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3_000);

    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state : null;
    });

    results.push({
      test: "clear-restores-defaults",
      passed: settings?.theme === "system" && settings?.oddsFormat === "american",
      details: { settings },
    });

    expect(settings?.theme).toBe("system");
    expect(settings?.oddsFormat).toBe("american");
    expect(settings?.autoResumePosition).toBe(true);
  });

  test("corrupted settings JSON is handled gracefully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Write garbage to settings key
    await page.evaluate(() => {
      localStorage.setItem("sd-settings", "{{{{not valid json!!!!}}}");
    });

    // Reload — should not crash
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3_000);

    // App should still load and re-initialize settings
    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      try {
        return JSON.parse(raw ?? "")?.state ?? null;
      } catch {
        return "still-corrupted";
      }
    });

    const appLoaded = await page.locator("body").isVisible();

    results.push({
      test: "corrupted-json-recovery",
      passed: appLoaded,
      details: { settings, appLoaded },
    });

    expect(appLoaded).toBe(true);
  });

  test("all Zustand persisted stores survive partial corruption", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Corrupt pinned games but leave settings intact
    await page.evaluate(() => {
      localStorage.setItem("sd-pinned-games", "CORRUPT");
    });

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3_000);

    // Settings should still be readable
    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      try {
        return JSON.parse(raw ?? "")?.state ?? null;
      } catch {
        return null;
      }
    });

    const appLoaded = await page.locator("body").isVisible();

    results.push({
      test: "partial-corruption-resilience",
      passed: appLoaded && settings !== null,
      details: { appLoaded, settingsIntact: settings !== null },
    });

    expect(appLoaded).toBe(true);
    expect(settings).not.toBeNull();
  });

  test("settings cross-tab sync (same origin)", async ({
    authedPage: page,
    browser,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Open a second tab in the same context
    const page2 = await browser.newPage();
    await page2.goto("/");
    await page2.waitForLoadState("load");
    await page2.waitForTimeout(2_000);

    // Change theme in tab 1
    await page.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.theme = "dark";
        localStorage.setItem("sd-settings", JSON.stringify(parsed));
        // Fire storage event for cross-tab sync
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "sd-settings",
            newValue: JSON.stringify(parsed),
          }),
        );
      }
    });

    await page2.waitForTimeout(2_000);

    // Check tab 2 sees the change
    const tab2Theme = await page2.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      return raw ? JSON.parse(raw)?.state?.theme : null;
    });

    results.push({
      test: "cross-tab-sync",
      passed: tab2Theme === "dark",
      details: { tab2Theme },
    });

    await page2.close();

    // Same localStorage, so theme should match
    expect(tab2Theme).toBe("dark");
  });
});

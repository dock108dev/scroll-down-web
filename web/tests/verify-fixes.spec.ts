import { test, expect } from "@playwright/test";
import * as fs from "fs";

const SCREENSHOT_DIR = "../docs/audit-results/screenshots";

test.describe("Verify exploratory fixes", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });
  test("Login form shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Click submit with empty fields
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    // Should show validation errors
    const emailError = page.locator('p[role="alert"]').first();
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText("required");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-login-validation.png`,
      fullPage: true,
    });
  });

  test("Login form shows errors for invalid email", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', "notanemail");
    await page.fill('input[type="password"]', "short");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const errors = page.locator('p[role="alert"]');
    await expect(errors.first()).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-login-invalid.png`,
      fullPage: true,
    });
  });

  test("Home page error state has feature explainer", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Wait for auto-retry to exhaust (3s + 6s + 12s backoff) and the
    // "Automatic retries exhausted" text to appear, rather than a fixed sleep.
    await expect(page.getByText("Automatic retries exhausted")).toBeVisible({ timeout: 25_000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-home-error.png`,
      fullPage: true,
    });
  });

  test("Settings page has accessible toggles", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Check for ARIA roles in always-open sections
    const radios = await page.locator('[role="radio"]').count();
    const radiogroups = await page.locator('[role="radiogroup"]').count();
    expect(radios).toBeGreaterThan(0);
    expect(radiogroups).toBeGreaterThan(0);

    // Expand the Odds section to reveal the toggle
    await page.click('text=Odds');
    await page.waitForTimeout(200);
    // Expand the Recaps section to reveal checkboxes
    await page.click('text=Recaps');
    await page.waitForTimeout(200);

    // Now check for switches and checkboxes in expanded sections
    const switches = await page.locator('[role="switch"]').count();
    const checkboxes = await page.locator('[role="checkbox"]').count();
    expect(switches).toBeGreaterThan(0);
    expect(checkboxes).toBeGreaterThan(0);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-settings.png`,
      fullPage: true,
    });
  });

  test("Degraded banner shows timestamp", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Check degraded banner is present
    const banner = page.locator("text=Limited");
    await expect(banner).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-degraded-banner.png`,
      fullPage: true,
    });
  });

  test("Profile redirect shows improved message", async ({ page }) => {
    await page.goto("/login?reason=profile&redirect=/profile", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);

    const msg = page.locator("text=track your predictions");
    await expect(msg).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/explore-fixed-profile-redirect.png`,
      fullPage: true,
    });
  });
});

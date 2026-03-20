import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(__dirname, "..", "..", "audit-results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");

const PAGES = [
  { name: "home", url: "/" },
  { name: "golf", url: "/golf" },
  { name: "fairbet", url: "/fairbet" },
  { name: "login", url: "/login" },
];

/**
 * Captures a full-page screenshot and compares it against a stored baseline.
 * On the first run (no baseline exists), the screenshot is saved as the new
 * baseline and the test passes. Subsequent runs diff against that baseline.
 */
async function compareOrCreateBaseline(
  page: import("@playwright/test").Page,
  name: string,
) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const baselinePath = path.join(SCREENSHOTS_DIR, `${name}-baseline.png`);
  const currentPath = path.join(SCREENSHOTS_DIR, `${name}-current.png`);

  await page.screenshot({ path: currentPath, fullPage: true });

  if (!fs.existsSync(baselinePath)) {
    // No baseline yet — save current as baseline
    fs.copyFileSync(currentPath, baselinePath);
    return;
  }

  // Compare against baseline using Playwright's built-in pixel matcher
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
}

test.describe("Audit: Visual regression — Desktop", () => {
  for (const pg of PAGES) {
    test(`desktop screenshot: ${pg.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(pg.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_000);

      await compareOrCreateBaseline(page, `${pg.name}-desktop`);
    });
  }
});

test.describe("Audit: Visual regression — Mobile", () => {
  for (const pg of PAGES) {
    test(`mobile screenshot: ${pg.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(pg.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_000);

      await compareOrCreateBaseline(page, `${pg.name}-mobile`);
    });
  }
});

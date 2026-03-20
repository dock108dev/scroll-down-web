import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "home", url: "/" },
  { name: "golf", url: "/golf" },
  { name: "fairbet", url: "/fairbet" },
  { name: "login", url: "/login" },
];

test.describe("Audit: Visual regression — Desktop", () => {
  for (const pg of PAGES) {
    test(`desktop screenshot: ${pg.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(pg.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_000);

      await expect(page).toHaveScreenshot(`${pg.name}-desktop.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      });
    });
  }
});

test.describe("Audit: Visual regression — Mobile", () => {
  for (const pg of PAGES) {
    test(`mobile screenshot: ${pg.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(pg.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_000);

      await expect(page).toHaveScreenshot(`${pg.name}-mobile.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      });
    });
  }
});

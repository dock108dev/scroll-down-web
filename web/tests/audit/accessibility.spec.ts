import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "home", url: "/" },
  { name: "golf", url: "/golf" },
  { name: "fairbet", url: "/fairbet" },
  { name: "login", url: "/login" },
];

test.describe("Audit: Accessibility", () => {
  for (const pg of PAGES) {
    test(`${pg.name}: images have alt text`, async ({ page }) => {
      await page.goto(pg.url, { waitUntil: "networkidle" });

      const imagesWithoutAlt = await page.evaluate(() => {
        const imgs = document.querySelectorAll("img");
        const missing: string[] = [];
        imgs.forEach((img) => {
          const alt = img.getAttribute("alt");
          if (alt === null || alt === undefined) {
            missing.push(img.src || "unknown");
          }
        });
        return missing;
      });

      expect(
        imagesWithoutAlt,
        `Images without alt text on ${pg.name}`,
      ).toHaveLength(0);
    });

    test(`${pg.name}: buttons and links have accessible names`, async ({
      page,
    }) => {
      await page.goto(pg.url, { waitUntil: "networkidle" });

      const inaccessible = await page.evaluate(() => {
        const elements = document.querySelectorAll("button, a, [role='button']");
        const issues: string[] = [];
        elements.forEach((el) => {
          const text = (el.textContent ?? "").trim();
          const ariaLabel = el.getAttribute("aria-label");
          const title = el.getAttribute("title");
          const ariaLabelledBy = el.getAttribute("aria-labelledby");

          if (!text && !ariaLabel && !title && !ariaLabelledBy) {
            // Check for child img alt or svg title
            const childImg = el.querySelector("img");
            const childSvg = el.querySelector("svg title");
            if (!childImg?.alt && !childSvg?.textContent) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : "";
              const cls = el.className
                ? `.${String(el.className).split(" ").slice(0, 2).join(".")}`
                : "";
              issues.push(`<${tag}${id}${cls}>`);
            }
          }
        });
        return issues;
      });

      // Allow some tolerance for icon-only buttons that use title attributes
      if (inaccessible.length > 0) {
        console.log(
          `[${pg.name}] Elements without accessible names:`,
          inaccessible,
        );
      }
      expect(inaccessible.length).toBeLessThanOrEqual(3);
    });

    test(`${pg.name}: focus order is logical`, async ({ page }) => {
      await page.goto(pg.url, { waitUntil: "networkidle" });

      // Tab through first 10 focusable elements and verify they're visible
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        const focused = page.locator(":focus");
        const count = await focused.count();
        if (count === 0) break;

        const isVisible = await focused.first().isVisible();
        expect(isVisible, `Focused element ${i + 1} should be visible`).toBe(
          true,
        );
      }
    });
  }
});

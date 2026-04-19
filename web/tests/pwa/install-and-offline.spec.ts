import { test, expect } from "@playwright/test";

const SESSION_COUNT_KEY = "sd-pwa-session-count";
const INSTALL_DISMISSED_KEY = "sd-pwa-install-dismissed";

// Helper: fire a synthetic beforeinstallprompt event from the page context.
// Real browsers control when this fires; in tests we dispatch it manually.
async function dispatchInstallPrompt(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { bubbles: true, cancelable: true });
    // Attach stub methods so the component can call .prompt() / .userChoice
    Object.assign(event, {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
}

test.describe("PWA install prompt", () => {
  test("does not appear on first session @smoke", async ({ page }) => {
    await page.goto("/");

    // Ensure session count is 1 (first visit)
    await page.evaluate(
      ([key]) => localStorage.setItem(key, "1"),
      [SESSION_COUNT_KEY]
    );

    await dispatchInstallPrompt(page);

    // Prompt must not be visible on first session
    const prompt = page.getByTestId("pwa-install-prompt");
    await expect(prompt).not.toBeVisible();
  });

  test("appears on second session when beforeinstallprompt fires @smoke", async ({
    page,
  }) => {
    // Pre-seed session count as 1 so that incrementing to 2 on mount triggers the banner
    await page.goto("/");
    await page.evaluate(
      ([key]) => localStorage.setItem(key, "1"),
      [SESSION_COUNT_KEY]
    );

    // Reload so the component re-mounts and increments count to 2
    await page.reload();
    await dispatchInstallPrompt(page);

    const prompt = page.getByTestId("pwa-install-prompt");
    await expect(prompt).toBeVisible({ timeout: 8_000 });
  });

  test("dismiss persists — prompt never reappears", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ([key]) => localStorage.setItem(key, "1"),
      [SESSION_COUNT_KEY]
    );

    await page.reload();
    await dispatchInstallPrompt(page);

    const prompt = page.getByTestId("pwa-install-prompt");
    await expect(prompt).toBeVisible({ timeout: 8_000 });

    // Dismiss the prompt
    await prompt.getByRole("button", { name: /dismiss/i }).click();
    await expect(prompt).not.toBeVisible();

    // Dismissed flag should be persisted
    const dismissed = await page.evaluate(([key]) => localStorage.getItem(key), [
      INSTALL_DISMISSED_KEY,
    ]);
    expect(dismissed).toBeTruthy();

    // Reload — prompt should not reappear even after firing the event
    await page.reload();
    await dispatchInstallPrompt(page);
    await expect(page.getByTestId("pwa-install-prompt")).not.toBeVisible();
  });

  test("absent in standalone display mode", async ({ page }) => {
    // Emulate standalone display mode via CSS media query override
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      // Stub matchMedia to return standalone=true for the display-mode query
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList;
        }
        return original(query);
      };
    });

    await page.goto("/");
    await page.evaluate(
      ([key]) => localStorage.setItem(key, "1"),
      [SESSION_COUNT_KEY]
    );
    await page.reload();
    await dispatchInstallPrompt(page);

    await expect(page.getByTestId("pwa-install-prompt")).not.toBeVisible();
  });
});

test.describe("Offline banner", () => {
  test("appears when connection is lost @smoke", async ({ page, context }) => {
    await page.goto("/");

    // Go offline
    await context.setOffline(true);

    // Trigger the offline event (setOffline may not fire it automatically in all cases)
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    const banner = page.getByTestId("offline-banner");
    await expect(banner).toBeVisible({ timeout: 5_000 });
  });

  test("auto-dismisses within 3s of reconnection @smoke", async ({
    page,
    context,
  }) => {
    await page.goto("/");

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    const banner = page.getByTestId("offline-banner");
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Restore connection
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Banner should disappear within 4s (3s auto-dismiss + margin)
    await expect(banner).not.toBeVisible({ timeout: 4_000 });
  });

  test("does not overlap reveal overlay or nav zones", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    const banner = page.getByTestId("offline-banner");
    await expect(banner).toBeVisible({ timeout: 5_000 });

    const bannerBox = await banner.boundingBox();
    expect(bannerBox).not.toBeNull();

    // Banner must be at the very top of the viewport (y < 60px) so it can't
    // overlap game rows that start further down the page.
    expect(bannerBox!.y).toBeLessThan(60);
  });
});

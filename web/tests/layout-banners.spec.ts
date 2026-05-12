import {
  test,
  expect,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke layout banners + loading states", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("home page renders the loading skeleton before /api/games/recent resolves", async ({ page }) => {
    let release: (() => void) | null = null;
    const blocked = new Promise<void>((res) => {
      release = res;
    });
    await page.route("**/api/games/recent", async (route) => {
      await blocked;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeRecentResponse()),
      });
    });

    const navigation = page.goto("/");
    // The default-variant skeleton sets data-testid="loading-skeleton".
    await expect(page.locator("[data-testid='loading-skeleton']").first()).toBeVisible();
    release!();
    await navigation;
    await expect(page.locator("[data-testid='loading-skeleton']")).toHaveCount(0);
  });

  test("offline banner shows on the browser 'offline' event and hides on 'online'", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");

    await expect(page.locator("[data-testid='offline-banner']")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator("[data-testid='offline-banner']")).toBeVisible();
    // OFFLINE_AUTO_DISMISS_MS is 3s — wait for the auto-dismiss path.
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.locator("[data-testid='offline-banner']")).toHaveCount(0, { timeout: 6_000 });
  });

  test("PWA install prompt: surfaces after enough sessions + a deferred prompt event, then dismisses", async ({ page }) => {
    // Seed PWA_SESSION_COUNT so the increment crosses INSTALL_MIN_SESSIONS=2
    // on this load.
    await page.addInitScript(() => {
      localStorage.setItem("sd-pwa-session-count", "2");
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    // Wait for React hydration before dispatching the event — PWAInstallPrompt
    // attaches its `beforeinstallprompt` listener inside a useEffect, so any
    // dispatch before mount is dropped on the floor.
    await page.locator("[data-testid='page-home']").waitFor();

    // Dispatch a synthetic beforeinstallprompt with no-op prompt/userChoice.
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });

    await expect(page.locator("[data-testid='pwa-install-prompt']")).toBeVisible();
    // Click Install — the handler calls prompt() + userChoice, then hides.
    await page.getByRole("button", { name: "Install", exact: true }).click();
    await expect(page.locator("[data-testid='pwa-install-prompt']")).toHaveCount(0);
  });

  test("Beta banner dismiss writes localStorage and hides", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    const banner = page.getByText("Beta", { exact: true }).first();
    await expect(banner).toBeVisible();
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(banner).toHaveCount(0);
    const dismissed = await page.evaluate(() =>
      localStorage.getItem("sd-beta-banner-dismissed"),
    );
    expect(dismissed).toBe("1");
  });

  test("DegradedBanner appears after 3 consecutive degraded health responses, then dismisses", async ({ page }) => {
    await page.clock.install();
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ status: "degraded", timestamp: new Date().toISOString() }),
      });
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    await page.locator("[data-testid='page-home']").waitFor();

    // FAILURE_THRESHOLD=3 + 60s polling. Advance past two more poll cycles
    // (initial check + 2 intervals = 3 failures) — banner appears after the
    // 3rd consecutive degraded response.
    await page.clock.fastForward(65_000);
    await page.clock.fastForward(65_000);

    await expect(page.locator("[data-testid='degraded-banner']")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Dismiss banner" }).click();
    await expect(page.locator("[data-testid='degraded-banner']")).toHaveCount(0);
  });

  test("PWA install prompt dismiss-X persists and won't re-show", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sd-pwa-session-count", "2");
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
    await page.goto("/");
    await page.locator("[data-testid='page-home']").waitFor();
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
    await expect(page.locator("[data-testid='pwa-install-prompt']")).toBeVisible();
    await page.getByRole("button", { name: "Dismiss install prompt" }).click();
    await expect(page.locator("[data-testid='pwa-install-prompt']")).toHaveCount(0);
    const dismissed = await page.evaluate(() => localStorage.getItem("sd-pwa-install-dismissed"));
    expect(dismissed).toBe("1");
  });
});

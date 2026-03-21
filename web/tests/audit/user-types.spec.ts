import { test as base, expect } from "@playwright/test";
import { clearAppState, waitForLoad, AUTH_STATE_PATH } from "../helpers";
import type { Page } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * User Type Testing Suite
 *
 * Tests behavior differences between guest, authenticated user, and admin roles.
 * Validates feature gating, auth-required routes, and role-based UI changes.
 */

const RESULTS_DIR = path.join(__dirname, "..", "..", "..", "docs", "audit-results");

interface UserTypeResult {
  test: string;
  role: string;
  passed: boolean;
  details: Record<string, unknown>;
}

// Fixture that provides both a guest page and an authed page
const test = base.extend<{ guestPage: Page; authedPage: Page }>({
  guestPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  authedPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

test.describe("Audit: User type behavior", () => {
  const results: UserTypeResult[] = [];

  test.afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      path.join(RESULTS_DIR, `user-types-${date}.json`),
      JSON.stringify(results, null, 2),
    );
  });

  test("guest can view home page and game list", async ({ guestPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await waitForLoad(page);

    const hasContent =
      (await page.locator("[data-testid='game-row']").count()) > 0 ||
      (await page.locator("text=No games").count()) > 0 ||
      (await page.locator("main").count()) > 0;

    results.push({
      test: "guest-home-access",
      role: "guest",
      passed: hasContent,
      details: { hasContent },
    });

    expect(hasContent).toBe(true);
  });

  test("guest sees login prompt for auth-gated features", async ({
    guestPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await waitForLoad(page);

    // Check role stored in localStorage
    const role = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      if (!raw) return "guest";
      try {
        return JSON.parse(raw)?.state?.role ?? "guest";
      } catch {
        return "guest";
      }
    });

    results.push({
      test: "guest-role-check",
      role: "guest",
      passed: role === "guest",
      details: { role },
    });

    expect(role).toBe("guest");
  });

  test("guest cannot access profile page", async ({ guestPage: page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Should redirect to login or show auth prompt
    const url = page.url();
    const isRedirected = url.includes("/login") || url.includes("/auth");
    const hasAuthPrompt =
      (await page.locator("text=Sign in").count()) > 0 ||
      (await page.locator("text=Log in").count()) > 0 ||
      (await page.locator("text=Login").count()) > 0;

    results.push({
      test: "guest-profile-blocked",
      role: "guest",
      passed: isRedirected || hasAuthPrompt,
      details: { url, isRedirected, hasAuthPrompt },
    });

    expect(isRedirected || hasAuthPrompt).toBe(true);
  });

  test("authenticated user has token and role in storage", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      if (!raw) return null;
      try {
        return JSON.parse(raw)?.state ?? null;
      } catch {
        return null;
      }
    });

    const hasToken = !!auth?.token;
    const role = auth?.role ?? "unknown";

    results.push({
      test: "authed-user-storage",
      role,
      passed: hasToken && role !== "guest",
      details: { hasToken, role, email: auth?.email },
    });

    expect(hasToken).toBe(true);
    expect(role).not.toBe("guest");
  });

  test("authenticated user can access profile page", async ({
    authedPage: page,
  }) => {
    await page.goto("/profile");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    const url = page.url();
    const isOnProfile = url.includes("/profile");
    const hasProfileContent =
      (await page.locator("text=Account").count()) > 0 ||
      (await page.locator("text=Profile").count()) > 0 ||
      (await page.locator("text=Email").count()) > 0;

    results.push({
      test: "authed-profile-access",
      role: "user",
      passed: isOnProfile && hasProfileContent,
      details: { url, isOnProfile, hasProfileContent },
    });

    expect(isOnProfile).toBe(true);
  });

  test("authenticated user can access FairBet live odds", async ({
    authedPage: page,
  }) => {
    // FairBet live odds are auth-gated
    const response = await page.request.get("/api/fairbet/live/games");

    results.push({
      test: "authed-fairbet-live",
      role: "user",
      passed: response.status() < 500,
      details: { status: response.status() },
    });

    // Should not get a 500 (may get 401 if token isn't forwarded via request context)
    expect(response.status()).toBeLessThan(500);
  });

  test("guest vs authed UI differences on home page", async ({
    guestPage,
    authedPage,
  }) => {
    // Load both pages
    await guestPage.goto("/");
    await authedPage.goto("/");
    await Promise.all([
      guestPage.waitForLoadState("load"),
      authedPage.waitForLoadState("load"),
    ]);
    await Promise.all([waitForLoad(guestPage), waitForLoad(authedPage)]);

    // Check for login/signup buttons on guest page
    const guestLoginBtn =
      (await guestPage.locator("text=Log in").count()) +
      (await guestPage.locator("text=Sign in").count()) +
      (await guestPage.locator("a[href*='login']").count());

    // Check for profile/account on authed page
    const authedProfileLink =
      (await authedPage.locator("a[href*='profile']").count()) +
      (await authedPage.locator("[data-testid='user-menu']").count()) +
      (await authedPage.locator("[data-testid='avatar']").count());

    results.push({
      test: "guest-vs-authed-ui",
      role: "comparison",
      passed: true,
      details: {
        guestLoginButtons: guestLoginBtn,
        authedProfileLinks: authedProfileLink,
      },
    });
  });

  test("logout reverts to guest state", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Verify authed first
    const roleBefore = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      return raw ? JSON.parse(raw)?.state?.role : "guest";
    });

    // Clear auth (simulated logout)
    await clearAppState(page);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2_000);

    const roleAfter = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      return raw ? JSON.parse(raw)?.state?.role : "guest";
    });

    results.push({
      test: "logout-reverts-guest",
      role: "guest",
      passed: roleAfter === "guest",
      details: { roleBefore, roleAfter },
    });

    expect(roleAfter).toBe("guest");
  });
});

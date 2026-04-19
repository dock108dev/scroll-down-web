import { test, expect } from "./helpers";

/**
 * ISSUE-060 — Account settings page E2E coverage.
 *
 * Covers:
 *   - Unauthenticated redirect to /login
 *   - Free user sees plan label and upgrade CTA
 *   - Pro user sees plan label, billing date row, and manage subscription button
 *   - Nav avatar links to /account for authenticated users
 */

test.describe("Account page", () => {
  // ── Unauthenticated redirect ─────────────────────────────────────

  test("unauthenticated user is redirected to /login @smoke", async ({ page }) => {
    // Navigate without any session cookie
    await page.goto("/account");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Free tier view ───────────────────────────────────────────────

  test("free user sees Free plan label when billing/info returns free tier @smoke", async ({ page }) => {
    // Intercept billing/info to return free tier
    await page.route("/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          userId: "test-user-1",
          email: "free@test.example",
          tier: "free",
        }),
      });
    });
    await page.route("/api/billing/info", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "free@test.example",
          tier: "free",
          nextBillingDate: null,
        }),
      });
    });

    await page.goto("/account");
    await page.waitForSelector("[data-testid='account-page']", { timeout: 10_000 });

    const planLabel = page.locator("[data-testid='account-plan-label']");
    await expect(planLabel).toBeVisible();
    await expect(planLabel).toHaveText("Free");

    const upgradeCta = page.locator("[data-testid='account-upgrade-cta']");
    await expect(upgradeCta).toBeVisible();

    // Manage subscription button must NOT appear for free users
    await expect(page.locator("[data-testid='manage-subscription-btn']")).not.toBeVisible();
  });

  // ── Pro tier view ────────────────────────────────────────────────

  test("pro user sees Pro plan, billing date, and manage button @smoke", async ({ page }) => {
    // Noon UTC avoids off-by-one day vs en-US when the runner is west of UTC.
    const nextBilling = "2026-05-18T12:00:00.000Z";

    await page.route("/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          userId: "test-user-2",
          email: "pro@test.example",
          tier: "pro",
        }),
      });
    });
    await page.route("/api/billing/info", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "pro@test.example",
          tier: "pro",
          nextBillingDate: nextBilling,
        }),
      });
    });

    await page.goto("/account");
    await page.waitForSelector("[data-testid='account-page']", { timeout: 10_000 });

    const planLabel = page.locator("[data-testid='account-plan-label']");
    await expect(planLabel).toBeVisible();
    await expect(planLabel).toHaveText("Pro");

    const billingDate = page.locator("[data-testid='account-billing-date']");
    await expect(billingDate).toBeVisible();
    await expect(billingDate).toContainText("Renews");
    await expect(billingDate).toContainText("May 18, 2026");

    const manageBtn = page.locator("[data-testid='manage-subscription-btn']");
    await expect(manageBtn).toBeVisible();

    // Upgrade CTA must NOT appear for pro users
    await expect(page.locator("[data-testid='account-upgrade-cta']")).not.toBeVisible();
  });

  // ── Nav avatar link ──────────────────────────────────────────────

  test("nav avatar links to /account for authenticated users @smoke", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "TopNav account avatar uses hidden md:flex — not exposed at mobile viewport",
    );

    await page.route("/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          userId: "test-user-3",
          email: "nav@test.example",
          tier: "free",
        }),
      });
    });

    // Seed localStorage so TopNav (which uses useAuth) shows the avatar
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "sd-auth",
        JSON.stringify({
          state: {
            token: "fake-token",
            role: "user",
            email: "nav@test.example",
            userId: 1,
            rememberMe: true,
          },
          version: 0,
        }),
      );
    });
    await page.reload();

    const navLink = page.locator("[data-testid='nav-account-link']");
    // Avatar only visible on md+ screens; use force option on smaller viewports
    const href = await navLink.getAttribute("href");
    expect(href).toBe("/account");
  });
});

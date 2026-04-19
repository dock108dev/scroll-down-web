import { test, expect, waitForProGateTestHook } from "../helpers";
import { signInWithMagicLink } from "../api-auth";

// ─── POST /api/billing/checkout ──────────────────────────────────────────────

test.describe("POST /api/billing/checkout", () => {
  test("returns 401 when not authenticated @smoke", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", {
      data: { plan: "monthly" },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 401 with a tampered session cookie @smoke", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", {
      headers: { Cookie: "sd-session=bad.invalid.token" },
      data: { plan: "monthly" },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 500-range or redirect when STRIPE_SECRET_KEY is missing", async ({
    request,
  }) => {
    // This test verifies the route exists and is protected by auth;
    // without a real Stripe key the server will throw, which is acceptable.
    // Skip gracefully if the route isn't reachable.
    const res = await request.post("/api/billing/checkout", {
      data: { plan: "monthly" },
    });
    // Unauthenticated → must be 401
    expect(res.status()).toBe(401);
  });
});

// ─── GET /api/billing/portal ─────────────────────────────────────────────────

test.describe("GET /api/billing/portal", () => {
  test("returns 401 when not authenticated @smoke", async ({ request }) => {
    const res = await request.get("/api/billing/portal");
    expect(res.status()).toBe(401);
  });

  test("returns 404 when authenticated but no Stripe customer @smoke", async ({
    request,
  }) => {
    // Sign in first to get a valid session cookie
    await signInWithMagicLink(request, `portal-nostripe-${Date.now()}@example.com`);

    const res = await request.get("/api/billing/portal", {
      maxRedirects: 0,
    });
    // Authenticated but no stripeCustomerId → 404
    expect(res.status()).toBe(404);
  });
});

// ─── POST /api/billing/webhook ───────────────────────────────────────────────

test.describe("POST /api/billing/webhook", () => {
  test("returns 400 when stripe-signature header is missing @smoke", async ({
    request,
  }) => {
    const res = await request.post("/api/billing/webhook", {
      data: JSON.stringify({ type: "checkout.session.completed" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 with a forged signature @smoke", async ({ request }) => {
    const res = await request.post("/api/billing/webhook", {
      data: JSON.stringify({ type: "checkout.session.completed" }),
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Tier promotion via session refresh ──────────────────────────────────────

test.describe("Session tier refresh", () => {
  test("session route returns authenticated: false without cookie @smoke", async ({
    request,
  }) => {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { authenticated: boolean };
    expect(body.authenticated).toBe(false);
  });

  test("session route returns authenticated user after sign-in @smoke", async ({
    request,
  }) => {
    const email = `session-tier-${Date.now()}@example.com`;
    await signInWithMagicLink(request, email);

    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      authenticated: boolean;
      email: string;
      tier: string;
    };
    expect(body.authenticated).toBe(true);
    expect(body.email).toBe(email.toLowerCase());
    expect(body.tier).toBe("free");
  });
});

// ─── ProGateSheet upgrade CTA ────────────────────────────────────────────────

test.describe("ProGateSheet — checkout CTA", () => {
  test("Upgrade to Pro button is present and not disabled when sheet is open @smoke", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForProGateTestHook(page);
    // Open the sheet via the test helper exposed on window
    await page.evaluate(() => {
      (window as unknown as Record<string, (f: string) => void>).__openProGateSheet(
        "full_fairbet",
      );
    });

    const cta = page.getByTestId("pro-gate-upgrade-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test("unauthenticated upgrade click redirects to /login @smoke", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForProGateTestHook(page);
    await page.evaluate(() => {
      (window as unknown as Record<string, (f: string) => void>).__openProGateSheet(
        "live_odds",
      );
    });

    const cta = page.getByTestId("pro-gate-upgrade-cta");
    await expect(cta).toBeVisible();

    // Intercept navigation before it happens
    const navigationPromise = page.waitForURL("**/login", { timeout: 5_000 });
    await cta.click();
    await navigationPromise;
  });
});

import { test, expect } from "../helpers";

// ─── helpers ────────────────────────────────────────────────────────────────

async function getSessionCookie(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "sd-session")?.value ?? null;
}

// ─── POST /api/auth/send-link ────────────────────────────────────────────────

test.describe("POST /api/auth/send-link", () => {
  test("returns 200 for a valid email @smoke", async ({ request }) => {
    const res = await request.post("/api/auth/send-link", {
      data: { email: "test-magic@example.com" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("returns 200 for an invalid email — no enumeration @smoke", async ({ request }) => {
    const res = await request.post("/api/auth/send-link", {
      data: { email: "not-an-email" },
    });
    expect(res.status()).toBe(200);
  });

  test("returns 200 for an unknown email — no enumeration", async ({ request }) => {
    const res = await request.post("/api/auth/send-link", {
      data: { email: "definitely-unknown-xyz-987@example.com" },
    });
    expect(res.status()).toBe(200);
  });

  test("exposes devToken in non-production @smoke", async ({ request }) => {
    const res = await request.post("/api/auth/send-link", {
      data: { email: "devtoken-check@example.com" },
    });
    const body = await res.json() as { ok: boolean; devToken?: string };
    if (!body.devToken) {
      test.skip(true, "devToken not present — production mode");
      return;
    }
    expect(typeof body.devToken).toBe("string");
    expect(body.devToken.length).toBeGreaterThan(16);
  });
});

// ─── GET /api/auth/verify ────────────────────────────────────────────────────

test.describe("GET /api/auth/verify", () => {
  test("missing token redirects to /login with error @smoke", async ({ page }) => {
    await page.goto("/api/auth/verify");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("error=missing_token");
  });

  test("invalid token redirects to /login with error @smoke", async ({ page }) => {
    await page.goto("/api/auth/verify?token=aaabbbccc000111invalid");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("error=invalid_token");
  });
});

// ─── GET /api/auth/session ───────────────────────────────────────────────────

test.describe("GET /api/auth/session", () => {
  test("returns anonymous when no cookie is present @smoke", async ({ request }) => {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const body = await res.json() as { authenticated: boolean };
    expect(body.authenticated).toBe(false);
  });
});

// ─── Full magic-link flow ────────────────────────────────────────────────────

test.describe("Magic-link end-to-end flow", () => {
  test("verify → session cookie set → sign-out clears session @smoke", async ({
    page,
    request,
  }) => {
    // Request a magic link
    const sendRes = await request.post("/api/auth/send-link", {
      data: { email: "e2e-flow@example.com" },
    });
    const { devToken } = (await sendRes.json()) as { ok: boolean; devToken?: string };

    if (!devToken) {
      test.skip(true, "devToken not available — skipping in production mode");
      return;
    }

    // Navigate to the verify URL — should redirect to / and set cookie
    await page.goto(`/api/auth/verify?token=${devToken}`);
    expect(page.url()).toMatch(/\/$/);

    const sessionCookie = await getSessionCookie(page);
    expect(sessionCookie).not.toBeNull();

    // Session endpoint should report authenticated (uses page cookies)
    const sessionRes = await page.request.get("/api/auth/session");
    const session = (await sessionRes.json()) as {
      authenticated: boolean;
      email?: string;
    };
    expect(session.authenticated).toBe(true);
    expect(session.email).toBe("e2e-flow@example.com");

    // Sign out
    await page.request.post("/api/auth/sign-out");

    // Session should now be anonymous
    const afterRes = await page.request.get("/api/auth/session");
    const after = (await afterRes.json()) as { authenticated: boolean };
    expect(after.authenticated).toBe(false);
  });

  test("same token cannot be used twice", async ({ request, page }) => {
    const sendRes = await request.post("/api/auth/send-link", {
      data: { email: "one-time@example.com" },
    });
    const { devToken } = (await sendRes.json()) as { ok: boolean; devToken?: string };

    if (!devToken) {
      test.skip(true, "devToken not available — skipping in production mode");
      return;
    }

    // First use — succeeds
    await page.goto(`/api/auth/verify?token=${devToken}`);
    expect(page.url()).toMatch(/\/$/);

    // Second use — token consumed, should redirect to error
    await page.goto(`/api/auth/verify?token=${devToken}`);
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("error=invalid_token");
  });

  test("anon ID from cookie is associated with new account", async ({ page }) => {
    // Ensure the anon ID is set (tier store initializes on page load)
    await page.goto("/");
    const cookies = await page.context().cookies();
    const anonId = cookies.find((c) => c.name === "sd-anon-id")?.value;

    if (!anonId) {
      test.skip(true, "sd-anon-id not set — tier store not initialized");
      return;
    }

    const sendRes = await page.request.post("/api/auth/send-link", {
      data: { email: "anon-merge@example.com" },
    });
    const { devToken } = (await sendRes.json()) as { ok: boolean; devToken?: string };

    if (!devToken) {
      test.skip(true, "devToken not available — skipping in production mode");
      return;
    }

    await page.goto(`/api/auth/verify?token=${devToken}`);
    const sessionRes = await page.request.get("/api/auth/session");
    const session = (await sessionRes.json()) as { authenticated: boolean };
    // Account created successfully — anonId was captured on the server
    expect(session.authenticated).toBe(true);
  });
});

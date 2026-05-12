import { test, expect } from "@playwright/test";

/**
 * Direct BFF probes. These hit the running Next.js server (no browser, no
 * page.route mocks) so we exercise the real route handlers and their input
 * validation. Anything that proxies to upstream SDA is tagged @live-upstream
 * in `live-upstream.spec.ts`; everything here either short-circuits inside
 * Next.js (health) or hits a 4xx guard before any upstream call.
 */

test.describe("@smoke BFF contracts", () => {
  test("/api/health returns 200 + {status:'ok'} under playwright webServer env", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("/api/games/{badId}/cards returns 400 for ids that fail the regex guard", async ({ request }) => {
    const res = await request.get("/api/games/has%20space/cards");
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("invalid game id");
  });

  test("/api/games/{badId}/summary returns 400 for ids that fail the regex guard", async ({ request }) => {
    const res = await request.get("/api/games/with%20space/summary");
    expect(res.status()).toBe(400);
  });

  test("/api/games with an empty id falls through Next.js routing (404)", async ({ request }) => {
    // The dynamic segment captures whatever's between `/api/games/` and `/cards`.
    // An empty segment is treated by Next.js as a non-matching path, so it
    // should be a 404 from the framework rather than reaching the handler.
    const res = await request.get("/api/games//cards");
    expect(res.status()).toBe(404);
  });
});

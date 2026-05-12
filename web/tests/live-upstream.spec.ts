import { test, expect } from "@playwright/test";
import { seedOnboarding } from "./helpers";

/**
 * Daily-only smoke against the real SDA upstream through the BFF. Each test
 * skips gracefully when the upstream has no rows (off-season, all-star break,
 * outage) so the daily lane stays green during dead weeks.
 *
 * PR Playwright runs `--grep-invert "@live-upstream"`; the @live-upstream tag
 * keeps these out of PR CI by design.
 */

test.describe("@live-upstream real SDA", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("@live-upstream /api/games/recent returns a well-shaped list", async ({ request }) => {
    const res = await request.get("/api/games/recent", { timeout: 30_000 });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { games?: unknown[] };
    expect(Array.isArray(body.games)).toBe(true);
    if (!body.games || body.games.length === 0) {
      test.skip(true, "Upstream returned zero games (off-season or outage) — not a regression.");
    }
  });

  test("@live-upstream a real game's deck loads with a scene setter", async ({ page, request }) => {
    const listRes = await request.get("/api/games/recent", { timeout: 30_000 });
    expect(listRes.status()).toBe(200);
    const list = (await listRes.json()) as {
      games?: Array<{ gameId: string; hasDeck: boolean }>;
    };
    const candidate = (list.games ?? []).find((g) => g.hasDeck);
    if (!candidate) {
      test.skip(true, "No game with hasDeck=true in the recent window.");
      return;
    }
    await page.goto(`/catchup/${candidate.gameId}`);
    await expect(page.locator("[data-testid='catchup-scene-setter']")).toBeVisible({
      timeout: 30_000,
    });
  });
});

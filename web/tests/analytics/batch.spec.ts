import { test, expect } from "../helpers";
import { waitForLoad } from "../helpers";

test.describe("Analytics: Batch simulation", () => {
  test("analytics page renders without errors", async ({
    authedPage: page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/analytics");
    await waitForLoad(page);

    // Filter out expected errors (e.g., API unavailable in test)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("Failed to fetch") && !e.includes("NetworkError"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("batch simulation API endpoint responds", async ({ request }) => {
    // SDA returns 503 + Retry-After (default 5s) on transient DB issues so
    // we retry up to twice before giving up. Genuine 500s (still a regression)
    // surface as a test failure as before.
    const url = "/api/analytics/batch-simulate-jobs";
    let res = await request.get(url);
    for (let attempt = 0; attempt < 2 && res.status() === 503; attempt++) {
      const retryAfterSec = Number(res.headers()["retry-after"] ?? "5");
      await new Promise((r) => setTimeout(r, Math.min(retryAfterSec, 10) * 1000));
      res = await request.get(url);
    }
    if (res.status() === 503) {
      test.skip(true, "Upstream still returning 503 after retries");
      return;
    }
    expect(res.status()).toBeLessThan(500);
  });
});

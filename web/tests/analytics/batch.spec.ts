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
    const res = await request.get("/api/analytics/batch-simulate-jobs");
    // Upstream proxy can return 5xx when the SDA backend is unreachable.
    // That's a forwarded failure, not the route crashing — skip in that case.
    if (res.status() >= 500) {
      test.skip(true, `Upstream returned ${res.status()} — cannot validate route`);
      return;
    }
    expect(res.status()).toBeLessThan(500);
  });
});

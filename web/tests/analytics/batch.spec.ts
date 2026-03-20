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
    // Should return some response (even if empty or unauthorized)
    expect(res.status()).toBeLessThan(500);
  });
});

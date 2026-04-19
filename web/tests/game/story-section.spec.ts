/**
 * ISSUE-037: Story section UI — quality gate, feedback API, and section placement.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const FEEDBACK_ENDPOINT = "/api/story-feedback";

// ─── Feedback API ─────────────────────────────────────────

async function postFeedback(
  request: APIRequestContext,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await request.post(FEEDBACK_ENDPOINT, { data: body });
  return { status: res.status(), json: await res.json() };
}

test.describe("story-feedback API @smoke", () => {
  test("accepts valid up vote", async ({ request }) => {
    const { status, json } = await postFeedback(request, {
      storyId: "123-1700000000000",
      vote: "up",
    });
    expect(status).toBe(200);
    expect((json as Record<string, unknown>).ok).toBe(true);
  });

  test("accepts valid down vote", async ({ request }) => {
    const { status, json } = await postFeedback(request, {
      storyId: "456-1700000000001",
      vote: "down",
    });
    expect(status).toBe(200);
    expect((json as Record<string, unknown>).ok).toBe(true);
  });

  test("rejects missing storyId", async ({ request }) => {
    const { status } = await postFeedback(request, { vote: "up" });
    expect(status).toBe(400);
  });

  test("rejects invalid vote value", async ({ request }) => {
    const { status } = await postFeedback(request, {
      storyId: "789-1700000000002",
      vote: "maybe",
    });
    expect(status).toBe(400);
  });

  test("rejects invalid JSON", async ({ request }) => {
    const res = await request.post(FEEDBACK_ENDPOINT, {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Quality gate: section absent from game pages ─────────

test.describe("story section — quality gate @smoke", () => {
  test("game-story-section absent when STORY_QUALITY_GATE=true (default)", async ({ page }) => {
    // Navigate to a game detail page. The actual game data may not exist,
    // but the test confirms the AI story section is never rendered in the DOM.
    // We skip gracefully if the page returns an error state (no live data).
    await page.goto("/game/1", { waitUntil: "domcontentloaded" });

    // Wait briefly for the page to settle (loading → data or error state).
    await page.waitForTimeout(1500);

    // The AI story section must not be in the DOM while quality gate is on.
    const storySection = page.getByTestId("game-story-section");
    await expect(storySection).toHaveCount(0);
  });
});

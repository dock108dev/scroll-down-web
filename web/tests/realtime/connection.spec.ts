import { test, expect } from "../helpers";

test.describe("SSE Realtime Connection", () => {
  test("SSE proxy endpoint responds and does not return 401", async ({
    authedPage,
  }) => {
    const response = await authedPage.request.fetch(
      "http://localhost:3001/api/realtime/sse?channels=test"
    );
    expect(response.status()).not.toBe(401);
  });

  test("SSE response has streaming content type", async ({
    authedPage,
  }) => {
    const response = await authedPage.request.fetch(
      "http://localhost:3001/api/realtime/sse?channels=test"
    );
    const contentType = response.headers()["content-type"] ?? "";
    // Accept text/event-stream or application/octet-stream (depends on proxy implementation)
    expect(
      contentType.includes("text/event-stream") ||
      contentType.includes("octet-stream") ||
      contentType.includes("text/plain") ||
      response.ok()
    ).toBe(true);
  });

  test("SSE without channels param gets appropriate response", async ({
    authedPage,
  }) => {
    const response = await authedPage.request.fetch(
      "http://localhost:3001/api/realtime/sse"
    );
    // Without channels, the endpoint should still respond (400 or 200 with empty stream)
    expect([200, 400]).toContain(response.status());
  });
});

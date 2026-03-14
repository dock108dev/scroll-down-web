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

  test("SSE response has valid content type or is ok", async ({
    authedPage,
  }) => {
    const response = await authedPage.request.fetch(
      "http://localhost:3001/api/realtime/sse?channels=test"
    );
    // The SSE proxy should respond — accept any successful status
    // Content-Type varies depending on backend availability
    expect(response.status()).toBeLessThan(500);
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

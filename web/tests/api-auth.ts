import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Completes the dev magic-link flow and returns the `sd-session` cookie value
 * for authenticated API requests (same pattern as freemium billing tests).
 */
export async function signInWithMagicLink(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const sendRes = await request.post("/api/auth/send-link", {
    data: { email },
  });
  expect(sendRes.status()).toBe(200);
  const { devToken } = (await sendRes.json()) as { devToken?: string };
  expect(devToken).toBeTruthy();

  const verifyRes = await request.get(`/api/auth/verify?token=${devToken}`, {
    maxRedirects: 0,
  });
  expect([302, 303, 307, 308]).toContain(verifyRes.status());

  const cookies = await request.storageState();
  const session = cookies.cookies.find((c) => c.name === "sd-session");
  expect(session).toBeTruthy();
  return session!.value;
}

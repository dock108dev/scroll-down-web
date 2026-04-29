import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";

vi.mock("@/lib/magic-link", () => ({
  verifySession: vi.fn(),
}));

describe("pro-gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SCROLLDOWN_E2E", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function req(opts: {
    tier?: string;
    sessionCookie?: string;
  }): NextRequest {
    const sp = new URLSearchParams();
    if (opts.tier !== undefined) sp.set("tier", opts.tier);
    return {
      nextUrl: { searchParams: sp },
      cookies: {
        get: (name: string) =>
          name === STORAGE_KEYS.SESSION && opts.sessionCookie
            ? { value: opts.sessionCookie }
            : undefined,
      },
    } as unknown as NextRequest;
  }

  it("allows dev tier=pro bypass when overrides enabled", async () => {
    const { requirePro } = await import("@/lib/pro-gate");
    expect(requirePro(req({ tier: "pro" }))).toBeNull();
  });

  it("allows valid pro session cookie", async () => {
    const magic = await import("@/lib/magic-link");
    vi.mocked(magic.verifySession).mockReturnValue({
      userId: "u",
      email: "a@b.com",
      tier: "pro",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const { requirePro } = await import("@/lib/pro-gate");
    expect(requirePro(req({ sessionCookie: "jwt-here" }))).toBeNull();
  });

  it("returns 402 when not pro", async () => {
    const magic = await import("@/lib/magic-link");
    vi.mocked(magic.verifySession).mockReturnValue({
      userId: "u",
      email: "a@b.com",
      tier: "free",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const { requirePro } = await import("@/lib/pro-gate");
    const res = requirePro(req({ sessionCookie: "jwt" }));
    expect(res?.status).toBe(402);

    vi.mocked(magic.verifySession).mockReturnValue(null);
    const res2 = requirePro(req({}));
    expect(res2?.status).toBe(402);
  });

  it("reads anon id cookie", async () => {
    const { getAnonId } = await import("@/lib/pro-gate");
    expect(
      getAnonId({
        cookies: {
          get: (name: string) =>
            name === STORAGE_KEYS.ANON_ID ? { value: "anon-1" } : undefined,
        },
      } as unknown as NextRequest),
    ).toBe("anon-1");
    expect(getAnonId(req({}) as NextRequest)).toBeNull();
  });
});

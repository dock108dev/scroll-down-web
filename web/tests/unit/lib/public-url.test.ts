import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

function req(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("publicBaseUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers PUBLIC_BASE_URL then MAGIC_LINK_BASE_URL", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://canonical.example/");
    const { publicBaseUrl } = await import("@/lib/public-url");
    expect(publicBaseUrl(req({ host: "evil.com" }))).toBe("https://canonical.example");

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("MAGIC_LINK_BASE_URL", "https://legacy.example");
    vi.stubEnv("NODE_ENV", "development");
    const mod = await import("@/lib/public-url");
    expect(mod.publicBaseUrl(req({ host: "evil.com" }))).toBe("https://legacy.example");
  });

  it("uses getSiteUrl in production without explicit base", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("MAGIC_LINK_BASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { publicBaseUrl } = await import("@/lib/public-url");
    expect(publicBaseUrl(req({ host: "ignored" }))).toContain("scrolldownsports");
  });

  it("builds origin from host and forwarded proto in development", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("MAGIC_LINK_BASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const { publicBaseUrl } = await import("@/lib/public-url");
    expect(publicBaseUrl(req({ host: "localhost:3001", "x-forwarded-proto": "https" }))).toBe(
      "https://localhost:3001",
    );
    expect(publicBaseUrl(req({}))).toBe("http://localhost:3001");
  });
});

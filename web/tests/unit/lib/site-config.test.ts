import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("site-config", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses PUBLIC_BASE_URL when set", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.com/");
    const { getSiteUrl, getSiteHost } = await import("@/lib/site-config");
    expect(getSiteUrl()).toBe("https://example.com");
    expect(getSiteHost()).toBe("example.com");
  });

  it("falls back to prod URL in production without explicit URL", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await import("@/lib/site-config");
    expect(getSiteUrl()).toContain("scrolldownsports.com");
  });

  it("falls back to dev URL outside production", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const { getSiteUrl } = await import("@/lib/site-config");
    expect(getSiteUrl()).toContain("scrolldownsports.dev");
  });

  it("interprets SITE_NOINDEX and host defaults", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.org");
    vi.stubEnv("SITE_NOINDEX", "true");
    let mod = await import("@/lib/site-config");
    expect(mod.isNoIndexSite()).toBe(true);

    vi.resetModules();
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.org");
    vi.stubEnv("SITE_NOINDEX", "false");
    mod = await import("@/lib/site-config");
    expect(mod.isNoIndexSite()).toBe(false);
  });
});

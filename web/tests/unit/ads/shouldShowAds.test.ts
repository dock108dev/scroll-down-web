import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const CONFIG_DEFAULTS = {
  ADS_ENABLED: "true",
  CLIENT_ID: "ca-pub-test1234567890",
};

async function loadShouldShowAds() {
  const mod = await import("@/lib/ads/entitlements");
  return mod.shouldShowAds;
}

describe("shouldShowAds", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", CONFIG_DEFAULTS.ADS_ENABLED);
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", CONFIG_DEFAULTS.CLIENT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for null viewer when ads are enabled and a client id is set", async () => {
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds(null)).toBe(true);
  });

  it("returns false for a paid authenticated viewer", async () => {
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds({ isAuthenticated: true, isPaid: true })).toBe(false);
  });

  it("returns false for an admin authenticated viewer", async () => {
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds({ isAuthenticated: true, isAdmin: true })).toBe(false);
  });

  it("returns false when the viewer has suppressAds set", async () => {
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds({ isAuthenticated: true, suppressAds: true })).toBe(false);
  });

  it("returns false when the global ADS_ENABLED kill switch is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "false");
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds(null)).toBe(false);
    expect(shouldShowAds({ isAuthenticated: true })).toBe(false);
  });

  it("returns false when the AdSense client id is absent or empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "");
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds(null)).toBe(false);
    expect(shouldShowAds({ isAuthenticated: true })).toBe(false);
  });

  it("returns true for a free authenticated viewer with no other flags set", async () => {
    const shouldShowAds = await loadShouldShowAds();
    expect(shouldShowAds({ isAuthenticated: true })).toBe(true);
  });
});

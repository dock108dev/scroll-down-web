import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/stores/tier", () => ({
  useTier: (fn: (s: { tier: string; initialized: boolean }) => unknown) =>
    fn({ tier: "free", initialized: true }),
}));

vi.mock("@/stores/auth", () => ({
  useAuth: (fn: (s: { role: string; token: string | null }) => unknown) =>
    fn({ role: "guest", token: null }),
}));

describe("useAdGate", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-test1234567890");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a boolean without throwing", async () => {
    const { useAdGate } = await import("@/lib/ads/useAdGate");
    const { result } = renderHook(() => useAdGate());
    expect(typeof result.current).toBe("boolean");
  });
});

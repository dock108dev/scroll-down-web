import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("stripe", () => ({
  default: class {
    constructor(_key: string, _opts: object) {}
  },
}));

describe("stripe helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123456789012345678901234567890123456789012345678901234567890");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123456789012345678901234567890");
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "price_monthly");
    vi.stubEnv("STRIPE_PRICE_ID_ANNUAL", "price_annual");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns lazy stripe client", async () => {
    const { getStripe } = await import("@/lib/stripe");
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
  });

  it("reads webhook secret and price ids", async () => {
    const { getWebhookSecret, getPriceId } = await import("@/lib/stripe");
    expect(getWebhookSecret()).toBe("whsec_test_123456789012345678901234567890");
    expect(getPriceId("monthly")).toBe("price_monthly");
    expect(getPriceId("annual")).toBe("price_annual");
  });

  it("throws when secrets are missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const stripeMod = await import("@/lib/stripe");
    expect(() => stripeMod.getStripe()).toThrow(/STRIPE_SECRET_KEY/);

    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123456789012345678901234567890123456789012345678901234567890");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const mod2 = await import("@/lib/stripe");
    expect(() => mod2.getWebhookSecret()).toThrow(/STRIPE_WEBHOOK_SECRET/);

    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "");
    const mod3 = await import("@/lib/stripe");
    expect(() => mod3.getPriceId("monthly")).toThrow(/STRIPE_PRICE_ID_MONTHLY/);
  });
});

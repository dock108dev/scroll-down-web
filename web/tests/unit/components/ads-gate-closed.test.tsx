import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/ads/useAdGate", () => ({
  useAdGate: () => false,
}));

vi.mock("@/components/ads/AdSlot", () => ({
  AdSlot: () => <div data-testid="ad-slot" />,
}));

describe("ad shells when gate is closed", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT", "feed-slot");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT", "fair-slot");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("FeedAd returns null so line 20 short-circuits", async () => {
    const { FeedAd } = await import("@/components/ads/FeedAd");
    const { container } = render(<FeedAd position="mid-feed" />);
    expect(container.firstChild).toBeNull();
  });

  it("FairBetAd returns null so line 20 short-circuits", async () => {
    const { FairBetAd } = await import("@/components/ads/FairBetAd");
    const { container } = render(<FairBetAd position="bottom" />);
    expect(container.firstChild).toBeNull();
  });

  it("GameDetailAd returns null when gate is closed", async () => {
    const { GameDetailAd } = await import("@/components/ads/GameDetailAd");
    const { container } = render(<GameDetailAd position="after-hero" />);
    expect(container.firstChild).toBeNull();
  });
});

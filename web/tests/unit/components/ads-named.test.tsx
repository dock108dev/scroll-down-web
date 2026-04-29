import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/ads/useAdGate", () => ({
  useAdGate: () => true,
}));

vi.mock("next/script", () => ({
  default: (props: { src?: string; id?: string }) => (
    <script data-testid={props.id} data-src={props.src} />
  ),
}));

vi.mock("@/components/ads/AdSlot", () => ({
  AdSlot: ({ slot }: { slot: string }) => <div data-testid={`slot-${slot}`}>{slot}</div>,
}));

describe("named ad shells", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT", "feed-slot");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT", "fair-slot");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT", "detail-slot");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT", "bottom-slot");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders FeedAd when slot env is set", async () => {
    const { FeedAd } = await import("@/components/ads/FeedAd");
    render(<FeedAd position="mid-feed" />);
    expect(screen.getByTestId("feed-ad-mid-feed")).toBeInTheDocument();
    expect(screen.getByTestId("slot-feed-slot")).toBeInTheDocument();
  });

  it("renders FairBetAd when slot env is set", async () => {
    const { FairBetAd } = await import("@/components/ads/FairBetAd");
    render(<FairBetAd position="bottom" />);
    expect(screen.getByTestId("fairbet-ad-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("slot-fair-slot")).toBeInTheDocument();
  });

  it("renders GameDetailAd for hero and bottom branches", async () => {
    const { GameDetailAd } = await import("@/components/ads/GameDetailAd");
    const { rerender } = render(<GameDetailAd position="after-hero" />);
    expect(screen.getByTestId("game-detail-ad-after-hero")).toBeInTheDocument();
    expect(screen.getByTestId("slot-detail-slot")).toBeInTheDocument();
    rerender(<GameDetailAd position="bottom" />);
    expect(screen.getByTestId("game-detail-ad-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("slot-bottom-slot")).toBeInTheDocument();
  });

  it("renders AdSenseScript loader when gated open", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-loader-test");
    const { AdSenseScript } = await import("@/components/ads/AdSenseScript");
    render(<AdSenseScript />);
    const script = screen.getByTestId("adsense-loader");
    expect(script.getAttribute("data-src")).toContain("pagead2.googlesyndication.com");
    expect(script.getAttribute("data-src")).toContain(encodeURIComponent("ca-pub-loader-test"));
  });
});

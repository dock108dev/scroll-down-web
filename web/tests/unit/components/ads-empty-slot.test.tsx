import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/ads/useAdGate", () => ({
  useAdGate: () => true,
}));

vi.mock("@/components/ads/AdSlot", () => ({
  AdSlot: ({ slot }: { slot: string }) => <div data-testid={`slot-${slot}`}>{slot}</div>,
}));

describe("GameDetailAd empty slot guard", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT", "hero-slot");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for bottom when bottom slot env is blank", async () => {
    const { GameDetailAd } = await import("@/components/ads/GameDetailAd");
    const { container } = render(<GameDetailAd position="bottom" />);
    expect(container.firstChild).toBeNull();
  });
});

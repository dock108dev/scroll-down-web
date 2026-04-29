import { describe, it, expect } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import {
  useTopBannerSlotClaimed,
  useClaimTopBannerSlot,
} from "@/lib/top-banner-slot";

function ToggleClaim({ active }: { active: boolean }) {
  useClaimTopBannerSlot("offline", active);
  return null;
}

describe("top-banner-slot", () => {
  it("reflects claimed slot via sync external store", () => {
    const { result } = renderHook(() => useTopBannerSlotClaimed());
    expect(result.current).toBe(false);

    const { rerender } = render(<ToggleClaim active={false} />);
    expect(result.current).toBe(false);

    act(() => {
      rerender(<ToggleClaim active={true} />);
    });
    expect(result.current).toBe(true);

    act(() => {
      rerender(<ToggleClaim active={false} />);
    });
    expect(result.current).toBe(false);
  });
});

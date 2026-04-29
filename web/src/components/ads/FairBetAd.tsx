"use client";

import { useAdGate } from "@/lib/ads/useAdGate";
import { ADSENSE_FAIRBET_SLOT } from "@/lib/ads/config";
import { AdSlot } from "./AdSlot";

export type FairBetAdPosition = "top-info" | "bottom";

interface FairBetAdProps {
  position: FairBetAdPosition;
}

/**
 * Named FairBet ad slot. FairBet is a trust page — placement is conservative
 * (above the bet list and after pagination) to avoid implying that book
 * names, prices, or EV numbers are sponsored. Reserved layout height is
 * smaller than feed/detail ads to keep the trust page visually contained.
 */
export function FairBetAd({ position }: FairBetAdProps) {
  const gateOpen = useAdGate();
  if (!gateOpen) return null;
  if (!ADSENSE_FAIRBET_SLOT) return null;

  return (
    <div
      data-testid={`fairbet-ad-${position}`}
      data-ad-position={position}
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40"
      aria-label="Sponsored"
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
        Ad
      </span>
      <AdSlot
        slot={ADSENSE_FAIRBET_SLOT}
        format="horizontal"
        minHeight={70}
        label="Sponsored"
      />
    </div>
  );
}

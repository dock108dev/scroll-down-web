"use client";

import { useAdGate } from "@/lib/ads/useAdGate";
import { ADSENSE_HOME_FEED_SLOT } from "@/lib/ads/config";
import { AdSlot } from "./AdSlot";

export type FeedAdPosition = "top-feed" | "mid-feed" | "bottom-feed";

interface FeedAdProps {
  position: FeedAdPosition;
}

/**
 * Named home-feed ad slot rendered inline between game cards. The card
 * chrome is contained (no sticky behavior) and reserves layout height to
 * avoid CLS while AdSense paints.
 */
export function FeedAd({ position }: FeedAdProps) {
  const gateOpen = useAdGate();
  if (!gateOpen) return null;
  if (!ADSENSE_HOME_FEED_SLOT) return null;

  return (
    <div
      data-testid={`feed-ad-${position}`}
      data-ad-position={position}
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40"
      aria-label="Sponsored"
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
        Ad
      </span>
      <AdSlot
        slot={ADSENSE_HOME_FEED_SLOT}
        format="auto"
        minHeight={100}
        label="Sponsored"
      />
    </div>
  );
}

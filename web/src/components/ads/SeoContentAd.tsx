"use client";

import { useAdGate } from "@/lib/ads/useAdGate";
import {
  ADSENSE_HOME_FEED_SLOT,
  ADSENSE_SEO_CONTENT_SLOT,
} from "@/lib/ads/config";
import { AdSlot } from "./AdSlot";

export type SeoContentAdPosition = "intro" | "inline" | "bottom";

interface SeoContentAdProps {
  position: SeoContentAdPosition;
}

export function SeoContentAd({ position }: SeoContentAdProps) {
  const gateOpen = useAdGate();
  if (!gateOpen) return null;

  const slot = ADSENSE_SEO_CONTENT_SLOT || ADSENSE_HOME_FEED_SLOT;
  if (!slot) return null;

  return (
    <div
      data-testid={`seo-content-ad-${position}`}
      data-ad-position={position}
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40"
      aria-label="Sponsored"
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
        Ad
      </span>
      <AdSlot
        slot={slot}
        format={position === "bottom" ? "auto" : "horizontal"}
        minHeight={position === "bottom" ? 100 : 90}
        label="Sponsored"
      />
    </div>
  );
}

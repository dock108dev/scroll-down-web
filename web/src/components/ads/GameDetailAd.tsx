"use client";

import { useAdGate } from "@/lib/ads/useAdGate";
import {
  ADSENSE_BOTTOM_SLOT,
  ADSENSE_GAME_DETAIL_SLOT,
} from "@/lib/ads/config";
import { AdSlot } from "./AdSlot";

export type GameDetailAdPosition =
  | "after-hero"
  | "between-sections"
  | "bottom";

interface GameDetailAdProps {
  position: GameDetailAdPosition;
}

/**
 * Named game-detail ad slot. Reserves layout height pre-mount to avoid CLS
 * while AdSense paints. Renders nothing when the relevant slot ID is blank —
 * empty boxes are a worse UX than no ad.
 */
export function GameDetailAd({ position }: GameDetailAdProps) {
  const gateOpen = useAdGate();
  if (!gateOpen) return null;

  const slot =
    position === "bottom" ? ADSENSE_BOTTOM_SLOT : ADSENSE_GAME_DETAIL_SLOT;
  if (!slot) return null;

  const format = position === "bottom" ? "auto" : "horizontal";
  const minHeight = position === "bottom" ? 100 : 90;

  return (
    <div
      data-testid={`game-detail-ad-${position}`}
      data-ad-position={position}
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40"
      aria-label="Sponsored"
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
        Ad
      </span>
      <AdSlot
        slot={slot}
        format={format}
        minHeight={minHeight}
        label="Sponsored"
      />
    </div>
  );
}

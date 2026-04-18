"use client";

import { useTier } from "@/stores/tier";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== "false";

export function DetailBannerAd() {
  const tier = useTier((s) => s.tier);

  if (!ADS_ENABLED || tier !== "free") return null;

  return (
    <div
      data-testid="detail-banner-ad"
      className="flex items-center justify-center mx-auto"
      style={{ width: 320, height: 50 }}
      aria-label="Advertisement"
    >
      <div className="flex w-full h-full items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 px-3">
        <span className="shrink-0 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
          Ad
        </span>
        <p className="flex-1 truncate text-[11px] text-neutral-400">
          Compare odds · Sponsored by a sportsbook partner
        </p>
      </div>
    </div>
  );
}

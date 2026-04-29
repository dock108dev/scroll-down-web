"use client";

import { useAdGate } from "@/lib/ads/useAdGate";

export function NativeAdCard() {
  if (!useAdGate()) return null;

  return (
    <div
      data-testid="native-ad-card"
      className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5"
      aria-label="Sponsored"
    >
      <span className="shrink-0 rounded bg-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
        Ad
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-neutral-300">
          Bet smarter — compare odds across top sportsbooks
        </p>
        <p className="truncate text-[11px] text-neutral-500">
          Sponsored by a sportsbook partner
        </p>
      </div>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-neutral-600"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

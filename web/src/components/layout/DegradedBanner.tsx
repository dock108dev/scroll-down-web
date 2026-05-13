"use client";

import { useEffect, useState, useRef } from "react";
import { setDegraded as setSharedDegraded } from "@/hooks/useHealthStatus";

/** Number of consecutive health-check failures before showing the banner. */
const FAILURE_THRESHOLD = 3;

type BannerState = { degraded: boolean; dismissed: boolean };

/**
 * Pings /api/health periodically and shows a non-alarmist banner when the
 * backend is returning stale/cached data. Requires FAILURE_THRESHOLD
 * consecutive failures to avoid false positives from transient retries.
 * Auto-dismisses when health recovers; resets dismissed state so the banner
 * reappears on subsequent degrade cycles.
 */
export function DegradedBanner() {
  const [{ degraded, dismissed }, setBannerState] = useState<BannerState>({
    degraded: false,
    dismissed: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function check() {
      let show = false;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (data.status === "degraded") {
          failCountRef.current++;
        } else {
          failCountRef.current = 0;
        }
        show = failCountRef.current >= FAILURE_THRESHOLD;
      } catch {
        if (!active) return;
        failCountRef.current++;
        show = failCountRef.current >= FAILURE_THRESHOLD;
      }

      // Update both flags atomically: on recovery, reset dismissed so the banner
      // reappears if the backend degrades again later.
      setBannerState((prev) => ({
        degraded: show,
        dismissed: show ? prev.dismissed : false,
      }));
      setSharedDegraded(show);
    }

    check();
    // Back off to 5 min when degraded to avoid console noise; 60 s when healthy.
    const pollMs = degraded ? 5 * 60_000 : 60_000;
    intervalRef.current = setInterval(check, pollMs);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [degraded]);

  if (!degraded || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="degraded-banner"
      className="w-full bg-yellow-500/15 border-b border-yellow-500/30"
    >
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm text-neutral-200">
        <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-yellow-400">
          Delayed
        </span>
        <span className="hidden sm:inline">
          Scores may be a few minutes behind.
        </span>
        <span className="sm:hidden">
          Data may be delayed.
        </span>
        <button
          onClick={() =>
            setBannerState((prev) => ({ ...prev, dismissed: true }))
          }
          className="ml-2 shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label="Dismiss banner"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

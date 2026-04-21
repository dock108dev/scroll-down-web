"use client";

import { useEffect, useState } from "react";
import { PWA } from "@/lib/config";
import { useClaimTopBannerSlot } from "@/lib/top-banner-slot";

export function OfflineBanner() {
  // Lazy initializer avoids a setState-in-effect for the initial online check.
  // typeof guard keeps SSR happy (navigator not available server-side).
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  useClaimTopBannerSlot("offline", offline);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    /** First `online` after going offline anchors the dismiss deadline (handles burst `online`). */
    let dismissDeadlineMs: number | null = null;

    function handleOffline() {
      dismissDeadlineMs = null;
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
      setOffline(true);
    }

    function handleOnline() {
      const now = Date.now();
      const delay = PWA.OFFLINE_AUTO_DISMISS_MS;
      if (dismissDeadlineMs === null) {
        dismissDeadlineMs = now + delay;
      }
      const remaining = Math.max(0, dismissDeadlineMs - now);
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        dismissTimer = null;
        dismissDeadlineMs = null;
        setOffline(false);
      }, remaining);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissDeadlineMs = null;
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="offline-banner"
      className="w-full bg-neutral-800 border-b border-neutral-700"
    >
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-neutral-400">
        <span className="size-1.5 rounded-full bg-neutral-500" aria-hidden="true" />
        No connection — showing cached data
      </div>
    </div>
  );
}

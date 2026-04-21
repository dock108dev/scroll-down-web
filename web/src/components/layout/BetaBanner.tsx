"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useHealthDegraded } from "@/hooks/useHealthStatus";
import { useTopBannerSlotClaimed } from "@/lib/top-banner-slot";

const DISMISSED_KEY = "sd-beta-banner-dismissed";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getSnapshot(): boolean {
  try {
    return !localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function BetaBanner() {
  const shouldShow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDegraded = useHealthDegraded();
  const higherPriorityBanner = useTopBannerSlotClaimed();
  const [dismissed, setDismissed] = useState(false);
  // Yield to degraded / offline / install banners to keep the top stack short on mobile.
  const visible = shouldShow && !dismissed && !isDegraded && !higherPriorityBanner;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="w-full bg-blue-500/10 border-b border-blue-500/20">
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-neutral-300">
        <span className="inline-flex items-center rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
          Beta
        </span>
        <span>
          Early version &mdash; some features are in progress.{" "}
          <a
            href="mailto:dock108dev@gmail.com?subject=Beta Feedback"
            className="inline-flex items-center font-medium text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] px-1"
          >
            Send feedback
          </a>
        </span>
        <button
          onClick={dismiss}
          className="ml-2 shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

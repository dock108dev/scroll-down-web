"use client";

import { useEffect, useState } from "react";

/**
 * Pings /api/health on mount and periodically.
 * Shows a subtle warning banner when the backend is degraded.
 */
export function DegradedBanner() {
  const [degraded, setDegraded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        if (active) setDegraded(data.status === "degraded");
      } catch {
        if (active) setDegraded(true);
      }
    }

    check();
    const id = setInterval(check, 60_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (!degraded || dismissed) return null;

  return (
    <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20">
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-neutral-300">
        <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
          Limited
        </span>
        <span>
          Some data may be temporarily unavailable. Cached results may be shown.
        </span>
        <button
          onClick={() => setDismissed(true)}
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

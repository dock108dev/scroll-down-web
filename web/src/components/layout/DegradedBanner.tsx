"use client";

import { useEffect, useState, useRef } from "react";
import { setDegraded as setSharedDegraded } from "@/hooks/useHealthStatus";

/** Format "Last checked X min ago" from a timestamp. */
function formatAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

/**
 * Pings /api/health on mount and periodically.
 * Shows a subtle warning banner when the backend is degraded.
 * Also publishes degraded state to the shared useHealthStatus hook.
 * Backs off polling to 5 min when degraded to reduce console noise.
 */
export function DegradedBanner() {
  const [degraded, setDegraded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastChecked, setLastChecked] = useState<number>(0);
  const [, forceUpdate] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        if (active) {
          const isDegraded = data.status === "degraded";
          setDegraded(isDegraded);
          setSharedDegraded(isDegraded);
          setLastChecked(Date.now());
        }
      } catch {
        if (active) {
          setDegraded(true);
          setSharedDegraded(true);
          setLastChecked(Date.now());
        }
      }
    }

    check();
    // Poll less frequently when degraded (5 min) vs healthy (60s)
    const pollMs = 5 * 60_000;
    intervalRef.current = setInterval(check, pollMs);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Update "ago" display every 30 seconds
  useEffect(() => {
    if (!degraded || dismissed) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [degraded, dismissed]);

  if (!degraded || dismissed) return null;

  return (
    <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20">
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-neutral-300">
        <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
          Limited
        </span>
        <span className="hidden sm:inline">
          Some data may be temporarily unavailable. Cached results may be shown.
        </span>
        <span className="sm:hidden">
          Some data may be unavailable.
        </span>
        {lastChecked > 0 && (
          <span className="text-neutral-500 hidden sm:inline">
            · Checked {formatAgo(lastChecked)}
          </span>
        )}
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

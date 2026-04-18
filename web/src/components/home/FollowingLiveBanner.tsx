"use client";

import { useSettings } from "@/stores/settings";
import { useFollowingLive } from "@/hooks/useFollowingLive";

/**
 * Banner shown when Following Live mode is active in onMarkRead reveal mode.
 * Explicitly communicates that score hiding is temporarily overridden so users
 * understand why scores are visible without a reveal action.
 */
export function FollowingLiveBanner() {
  const followingLive = useSettings((s) => s.followingLive);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const { toggle } = useFollowingLive();

  if (!followingLive || scoreRevealMode !== "onMarkRead") return null;

  return (
    <div
      data-testid="following-live-banner"
      className="mx-4 mt-3 px-3 py-2.5 rounded-lg bg-green-900/20 border border-green-800/40 flex items-start justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs text-green-300 leading-snug">
        <span className="font-semibold">Following Live is on</span> — score hiding is
        paused. All scores are visible while this mode is active.
      </p>
      <button
        data-testid="following-live-banner-dismiss"
        onClick={toggle}
        className="shrink-0 text-xs font-medium text-green-400 hover:text-green-200 transition underline whitespace-nowrap"
        aria-label="Turn off Following Live to re-hide scores"
      >
        Turn off
      </button>
    </div>
  );
}

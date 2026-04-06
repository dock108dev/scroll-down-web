"use client";

import { useAuth } from "@/stores/auth";
import { useSettings } from "@/stores/settings";

interface StaleBannerProps {
  stale: boolean;
  staleAt: number | null;
  onRetry?: () => void;
}

function formatTimeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

/**
 * Admin-only banner indicating stale/cached data is being displayed.
 * Hidden for non-admin users and when the admin has toggled it off in settings.
 */
export function StaleBanner({ stale, staleAt, onRetry }: StaleBannerProps) {
  const role = useAuth((s) => s.role);
  const showStaleBanners = useSettings((s) => s.showStaleBanners);

  if (!stale || role !== "admin" || !showStaleBanners) return null;

  return (
    <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-xs text-yellow-500">
      <span>
        Showing cached data{staleAt ? ` · last updated ${formatTimeAgo(staleAt)}` : ""}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto shrink-0 font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

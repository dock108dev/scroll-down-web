"use client";

import { useEffect } from "react";
import { CACHE } from "@/lib/config";

/**
 * Calls `onRefresh` when the tab returns from background.
 * Always refreshes if hidden > VISIBILITY_AWAY_MS, or if realtime is offline.
 */
export function useVisibilityRefresh(
  onRefresh: () => void,
  realtimeConnected: boolean,
) {
  useEffect(() => {
    let hiddenAt = 0;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        const away = hiddenAt ? Date.now() - hiddenAt : 0;
        if (away > CACHE.VISIBILITY_AWAY_MS || !realtimeConnected) {
          onRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onRefresh, realtimeConnected]);
}

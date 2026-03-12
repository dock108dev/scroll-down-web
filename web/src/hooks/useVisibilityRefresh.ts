"use client";

import { useEffect, useRef } from "react";
import { CACHE } from "@/lib/config";

/**
 * Calls `onRefresh` when the tab returns from background.
 * Always refreshes if hidden > VISIBILITY_AWAY_MS, or if realtime is offline.
 */
export function useVisibilityRefresh(
  onRefresh: () => void,
  realtimeConnected: boolean,
) {
  const hiddenAtRef = useRef(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const away = hiddenAtRef.current
          ? Date.now() - hiddenAtRef.current
          : 0;
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

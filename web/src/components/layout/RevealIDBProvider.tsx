"use client";

import { useEffect } from "react";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { POLLING } from "@/lib/config";

/**
 * Mounts once in the root layout. Responsibilities:
 * 1. Initialize the reveal store from IndexedDB (+ one-time localStorage migration).
 * 2. Flush the offline sync queue when the browser reconnects.
 * 3. Self-heal stuck followingLive: if it's been on past its TTL, clear it.
 *    The settings store's merge() already does this during localStorage
 *    rehydration, but we re-check on every mount to recover from cases where
 *    a server sync or manual localStorage edit left it stuck.
 */
export function RevealIDBProvider() {
  const initialize = useReveal((s) => s.initialize);
  const flushOfflineQueue = useReveal((s) => s.flushOfflineQueue);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const { followingLive, followingLiveAt, setFollowingLive } = useSettings.getState();
    if (
      followingLive &&
      (!followingLiveAt ||
        Date.now() - followingLiveAt >= POLLING.FOLLOWING_LIVE_TTL_MS)
    ) {
      setFollowingLive(false);
    }
  }, []);

  useEffect(() => {
    function handleOnline() {
      flushOfflineQueue().catch((err) => {
        console.error("[reveal] flushOfflineQueue failed on reconnect:", err);
      });
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushOfflineQueue]);

  return null;
}

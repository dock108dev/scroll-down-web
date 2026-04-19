"use client";

import { useEffect } from "react";
import { useReveal } from "@/stores/reveal";

/**
 * Mounts once in the root layout. Responsibilities:
 * 1. Initialize the reveal store from IndexedDB (+ one-time localStorage migration).
 * 2. Flush the offline sync queue when the browser reconnects.
 */
export function RevealIDBProvider() {
  const initialize = useReveal((s) => s.initialize);
  const flushOfflineQueue = useReveal((s) => s.flushOfflineQueue);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

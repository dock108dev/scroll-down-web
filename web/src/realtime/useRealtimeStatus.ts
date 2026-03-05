"use client";

import { useEffect } from "react";
import { getTransport } from "./transport";
import { initRealtimeDispatcher } from "./dispatcher";
import { useGameData } from "@/stores/game-data";

/**
 * Syncs the transport singleton's status into the Zustand store.
 * Mount once near the app root (e.g., in layout).
 * Uses a low-frequency poll — the dispatcher handles lastEventAt updates.
 */
export function useRealtimeStatusSync(): void {
  const setRealtimeStatus = useGameData((s) => s.setRealtimeStatus);

  useEffect(() => {
    initRealtimeDispatcher();

    const transport = getTransport();
    const sync = () => setRealtimeStatus(transport.getStatus());

    sync();
    const interval = setInterval(sync, 2_000);

    return () => {
      clearInterval(interval);
    };
  }, [setRealtimeStatus]);
}

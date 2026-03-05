"use client";

import { useRealtimeStatusSync } from "@/realtime/useRealtimeStatus";

/**
 * Client component that bridges the realtime transport singleton
 * with the Zustand store. Mount once in the app layout.
 * Renders nothing — purely a side-effect provider.
 */
export function RealtimeProvider() {
  useRealtimeStatusSync();
  return null;
}

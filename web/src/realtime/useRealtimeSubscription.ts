"use client";

import { useEffect, useRef } from "react";
import { getTransport } from "./transport";
import { initRealtimeDispatcher } from "./dispatcher";

/**
 * Subscribe to realtime channels for the lifetime of the component.
 * Automatically subscribes on mount / channel change and unsubscribes on
 * unmount / channel removal.
 *
 * The centralized dispatcher handles all message routing — hooks only
 * manage channel subscriptions via this hook.
 */
export function useRealtimeSubscription(channels: string[]): void {
  const prevChannelsRef = useRef<string[]>([]);

  useEffect(() => {
    // Ensure dispatcher is initialized (idempotent)
    initRealtimeDispatcher();

    const transport = getTransport();
    const prev = new Set(prevChannelsRef.current);
    const next = new Set(channels);

    for (const ch of next) {
      if (!prev.has(ch)) {
        transport.subscribe(ch);
      }
    }

    for (const ch of prev) {
      if (!next.has(ch)) {
        transport.unsubscribe(ch);
      }
    }

    prevChannelsRef.current = channels;

    return () => {
      for (const ch of channels) {
        transport.unsubscribe(ch);
      }
      prevChannelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.join(",")]);
}

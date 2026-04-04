"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared module-level degraded state.
 * DegradedBanner writes to it; other components read via useSyncExternalStore.
 */
let degraded = false;
const listeners = new Set<() => void>();

export function setDegraded(value: boolean) {
  if (degraded === value) return;
  degraded = value;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return degraded;
}

function getServerSnapshot() {
  return false;
}

/** Returns true when the backend health check reports degraded status. */
export function useHealthDegraded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

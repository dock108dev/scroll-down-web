"use client";

import { useEffect, useSyncExternalStore } from "react";

// Shared signal for top-of-page banner visibility. Banners with higher priority
// (Offline, PWAInstallPrompt) call `claimTopBannerSlot` while mounted; lower-
// priority banners (Beta) subscribe and hide themselves when a higher slot is
// claimed, keeping the mobile banner stack from eating viewport height.

type Claim = "offline" | "pwa-install";

const claims = new Set<Claim>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return claims.size > 0;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useTopBannerSlotClaimed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useClaimTopBannerSlot(key: Claim, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    claims.add(key);
    emit();
    return () => {
      claims.delete(key);
      emit();
    };
  }, [key, active]);
}

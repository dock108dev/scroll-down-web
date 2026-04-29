"use client";

import { useTier } from "@/stores/tier";
import { useAuth } from "@/stores/auth";
import { shouldShowAds, type ViewerEntitlements } from "./entitlements";

/**
 * Single-source gating hook for the per-component ad slots. Reads the tier
 * + auth stores, derives ViewerEntitlements, and applies shouldShowAds() so
 * paid and admin viewers never see an ad slot. Returns false until the tier
 * store has hydrated to avoid a free-tier flash for paid viewers on first
 * paint. Consolidates duplicated gating across FairBetAd, FeedAd, and
 * GameDetailAd. See docs/audits/cleanup-report.md.
 */
export function useAdGate(): boolean {
  const tier = useTier((s) => s.tier);
  const initialized = useTier((s) => s.initialized);
  const role = useAuth((s) => s.role);
  const token = useAuth((s) => s.token);

  if (!initialized) return false;

  const viewer: ViewerEntitlements = {
    isAuthenticated: token !== null && role !== "guest",
    isAdmin: role === "admin",
    isPaid: tier === "pro",
  };

  return shouldShowAds(viewer);
}

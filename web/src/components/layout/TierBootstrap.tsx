"use client";

import { useLayoutEffect } from "react";
import { useTier } from "@/stores/tier";

/**
 * Ensures the tier store runs on every route (not only FairBet pages) and
 * seeds anon + cookies in the layout phase so localStorage is ready before paint.
 */
export function TierBootstrap() {
  useTier((s) => s.tier);

  useLayoutEffect(() => {
    useTier.getState().initialize();
  }, []);

  return null;
}

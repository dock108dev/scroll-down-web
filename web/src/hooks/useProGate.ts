import { useTier } from "@/stores/tier";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { FEATURE_GATES } from "@/lib/config";
import type { FeatureGateKey } from "@/lib/config";

const GATED_FEATURES = new Set<string>(Object.values(FEATURE_GATES));

export interface ProGateResult {
  allowed: boolean;
  tier: "free" | "pro";
  /**
   * Call before executing the gated action. Captures the triggering element
   * for focus restore, opens the upgrade sheet if the user is on the free
   * tier, and returns whether the action is allowed to proceed.
   */
  gate: (triggerEl?: HTMLElement | null) => boolean;
}

/**
 * Synchronous gate check for a Pro-gated feature. Reads from the Zustand tier
 * store so the result is always up-to-date without a network round-trip.
 *
 * @param feature - One of the keys from FEATURE_GATES in src/lib/config.ts.
 */
export function useProGate(feature: FeatureGateKey): ProGateResult {
  const tier = useTier((s) => s.tier);
  const openSheet = useProGateSheet((s) => s.openSheet);
  const allowed = tier === "pro" && GATED_FEATURES.has(feature);

  function gate(triggerEl?: HTMLElement | null): boolean {
    if (allowed) return true;
    const el =
      triggerEl !== undefined
        ? triggerEl
        : typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null;
    openSheet(feature, el);
    return false;
  }

  return { allowed, tier, gate };
}

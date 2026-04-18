import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, FEATURE_GATES } from "@/lib/config";
import type { FeatureGateKey } from "@/lib/config";

export type Tier = "free" | "pro";

const GATED_FEATURES = new Set<string>(Object.values(FEATURE_GATES));

interface TierState {
  tier: Tier;
  anonId: string;
  initialized: boolean;

  initialize: () => void;
  isAllowed: (feature: FeatureGateKey) => boolean;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function syncCookies(anonId: string, tier: Tier): void {
  if (typeof document === "undefined") return;
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${STORAGE_KEYS.ANON_ID}=${anonId}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${STORAGE_KEYS.TIER}=${tier}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function resolveDevTierOverride(current: Tier): Tier {
  if (typeof window === "undefined") return current;
  if (process.env.NODE_ENV === "production") return current;
  const param = new URLSearchParams(window.location.search).get("tier");
  if (param === "pro") return "pro";
  if (param === "free") return "free";
  return current;
}

export const useTier = create<TierState>()(
  persist(
    (set, get) => ({
      tier: "free" as Tier,
      anonId: "",
      initialized: false,

      initialize: () => {
        if (typeof window === "undefined") return;

        let { tier, anonId } = get();

        tier = resolveDevTierOverride(tier);

        if (!anonId) {
          anonId = generateUUID();
        }

        set({ tier, anonId, initialized: true });
        syncCookies(anonId, tier);
      },

      isAllowed: (feature) => {
        return get().tier === "pro" && GATED_FEATURES.has(feature);
      },
    }),
    {
      name: STORAGE_KEYS.TIER,
      partialize: (state) => ({
        tier: state.tier,
        anonId: state.anonId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Sync cookies and apply dev override after localStorage hydration
          state.initialize();
        }
      },
    },
  ),
);

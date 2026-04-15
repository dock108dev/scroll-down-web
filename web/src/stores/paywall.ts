import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, PAYWALL } from "@/lib/config";
import { trackEvent } from "@/lib/analytics";

export type PaywallTrigger =
  | "post_first_reveal"
  | "daily_limit_hit"
  | "gated_feature";

interface PaywallState {
  lastDismissedAt: number | null;
  hasCompletedFirstReveal: boolean;
  hasSeenPostRevealPaywall: boolean;

  // Actions
  dismiss: () => void;
  markFirstRevealCompleted: () => void;
  markPostRevealPaywallSeen: () => void;

  // Selectors
  canShowPaywall: (trigger: PaywallTrigger) => boolean;
  isDismissCooldownActive: () => boolean;
}

export const usePaywall = create<PaywallState>()(
  persist(
    (set, get) => ({
      lastDismissedAt: null,
      hasCompletedFirstReveal: false,
      hasSeenPostRevealPaywall: false,

      dismiss: () => {
        trackEvent("paywall_dismiss");
        set({ lastDismissedAt: Date.now() });
      },

      markFirstRevealCompleted: () => {
        if (!get().hasCompletedFirstReveal) {
          set({ hasCompletedFirstReveal: true });
        }
      },

      markPostRevealPaywallSeen: () => {
        set({ hasSeenPostRevealPaywall: true });
      },

      canShowPaywall: (trigger) => {
        const state = get();

        if (trigger === "gated_feature") return true;

        if (trigger === "daily_limit_hit") {
          return !state.isDismissCooldownActive();
        }

        if (trigger === "post_first_reveal") {
          if (state.hasSeenPostRevealPaywall) return false;
          if (!state.hasCompletedFirstReveal) return false;
          return !state.isDismissCooldownActive();
        }

        return false;
      },

      isDismissCooldownActive: () => {
        const { lastDismissedAt } = get();
        if (!lastDismissedAt) return false;
        return Date.now() - lastDismissedAt < PAYWALL.FREQUENCY_CAP_MS;
      },
    }),
    {
      name: STORAGE_KEYS.PAYWALL,
      version: 1,
      partialize: (state) => ({
        lastDismissedAt: state.lastDismissedAt,
        hasCompletedFirstReveal: state.hasCompletedFirstReveal,
        hasSeenPostRevealPaywall: state.hasSeenPostRevealPaywall,
      }),
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/lib/config";
import { findMlbTeam } from "@/lib/mlb-teams";

interface OnboardingState {
  /** True after the user picks a team or explicitly skips the picker. */
  onboarded: boolean;
  /** Three-letter MLB team abbreviation, or null when user skipped. */
  favoriteTeam: string | null;

  setFavoriteTeam: (abbr: string) => void;
  skipOnboarding: () => void;
  clearFavoriteTeam: () => void;
  resetOnboarding: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      onboarded: false,
      favoriteTeam: null,

      setFavoriteTeam: (abbr) => {
        const team = findMlbTeam(abbr);
        if (!team) return;
        set({ onboarded: true, favoriteTeam: team.abbr });
      },
      skipOnboarding: () => set({ onboarded: true, favoriteTeam: null }),
      clearFavoriteTeam: () => set({ favoriteTeam: null }),
      resetOnboarding: () => set({ onboarded: false, favoriteTeam: null }),
    }),
    {
      name: STORAGE_KEYS.ONBOARDING,
      version: 1,
    },
  ),
);

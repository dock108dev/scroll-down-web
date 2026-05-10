import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/config";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  theme: ThemeMode;
  /** Show "displaying cached data" banner during upstream blips. */
  showStaleBanners: boolean;

  setTheme: (t: ThemeMode) => void;
  setShowStaleBanners: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULTS.THEME as ThemeMode,
      showStaleBanners: true,

      setTheme: (theme) => set({ theme }),
      setShowStaleBanners: (showStaleBanners) => set({ showStaleBanners }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      version: 2,
      migrate: (persisted: unknown, _version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        // v1 carried score-reveal mode, blacklists, timeline tiers, follow-live —
        // none of those exist in the catch-up-first product. Drop them.
        delete state.scoreRevealMode;
        delete state.scoreHideLeagues;
        delete state.scoreHideTeams;
        delete state.timelineDefaultTiers;
        delete state.followingLive;
        delete state.followingLiveAt;
        delete state.autoResumePosition;
        delete state.preferredSportsbook;
        delete state.oddsFormat;
        delete state.hideLimitedData;
        delete state.homeExpandedSections;
        if (typeof state.theme !== "string") state.theme = DEFAULTS.THEME;
        if (typeof state.showStaleBanners !== "boolean") state.showStaleBanners = true;
        return state as never;
      },
    },
  ),
);

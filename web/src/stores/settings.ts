import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/config";

export type ThemeMode = "system" | "light" | "dark";
export type AutoRevealDelayMs = 0 | 1000 | 2000 | 3000;
export type AutoAdvanceDelayMs = 0 | 10000 | 15000 | 20000 | 30000;

interface SettingsState {
  theme: ThemeMode;
  /** Show "displaying cached data" banner during upstream blips. */
  showStaleBanners: boolean;
  /** Catch-up card automation. 0 means manual mode. */
  autoRevealDelayMs: AutoRevealDelayMs;
  autoAdvanceDelayMs: AutoAdvanceDelayMs;
  /** Keep play cards in pre-pitch state until explicitly revealed. */
  spoilerSafeMode: boolean;

  setTheme: (t: ThemeMode) => void;
  setShowStaleBanners: (v: boolean) => void;
  setAutoRevealDelayMs: (delay: AutoRevealDelayMs) => void;
  setAutoAdvanceDelayMs: (delay: AutoAdvanceDelayMs) => void;
  setSpoilerSafeMode: (enabled: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULTS.THEME as ThemeMode,
      showStaleBanners: true,
      autoRevealDelayMs: 0,
      autoAdvanceDelayMs: 0,
      spoilerSafeMode: true,

      setTheme: (theme) => set({ theme }),
      setShowStaleBanners: (showStaleBanners) => set({ showStaleBanners }),
      setAutoRevealDelayMs: (autoRevealDelayMs) => set({ autoRevealDelayMs }),
      setAutoAdvanceDelayMs: (autoAdvanceDelayMs) => set({ autoAdvanceDelayMs }),
      setSpoilerSafeMode: (spoilerSafeMode) => set({ spoilerSafeMode }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      version: 3,
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
        if (![0, 1000, 2000, 3000].includes(Number(state.autoRevealDelayMs))) {
          state.autoRevealDelayMs = 0;
        }
        if (![0, 10000, 15000, 20000, 30000].includes(Number(state.autoAdvanceDelayMs))) {
          state.autoAdvanceDelayMs = 0;
        }
        if (typeof state.spoilerSafeMode !== "boolean") state.spoilerSafeMode = true;
        return state as never;
      },
    },
  ),
);

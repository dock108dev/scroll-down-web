import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FairbetSortOption = "bestEV" | "gameTime" | "league";

interface SettingsState {
  theme: "system" | "light" | "dark";
  scoreRevealMode: "always" | "onMarkRead";
  preferredSportsbook: string;
  oddsFormat: "american" | "decimal" | "fractional";
  autoResumePosition: boolean;
  homeExpandedSections: string[];
  gameExpandedSections: string[];
  hideLimitedData: boolean;
  showOnlyPositiveEV: boolean;
  fairbetSortOption: FairbetSortOption;

  setTheme: (t: "system" | "light" | "dark") => void;
  setScoreRevealMode: (m: "always" | "onMarkRead") => void;
  setPreferredSportsbook: (b: string) => void;
  setOddsFormat: (f: "american" | "decimal" | "fractional") => void;
  setAutoResumePosition: (v: boolean) => void;
  setHomeExpandedSections: (s: string[]) => void;
  setGameExpandedSections: (s: string[]) => void;
  setHideLimitedData: (v: boolean) => void;
  setShowOnlyPositiveEV: (v: boolean) => void;
  setFairbetSortOption: (o: FairbetSortOption) => void;
  toggleHomeSection: (section: string) => void;
  toggleGameSection: (section: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "system",
      scoreRevealMode: "onMarkRead",
      preferredSportsbook: "",
      oddsFormat: "american",
      autoResumePosition: true,
      homeExpandedSections: ["Today", "Yesterday"],
      gameExpandedSections: [],
      hideLimitedData: true,
      showOnlyPositiveEV: false,
      fairbetSortOption: "bestEV",

      setTheme: (theme) => set({ theme }),
      setScoreRevealMode: (scoreRevealMode) => set({ scoreRevealMode }),
      setPreferredSportsbook: (preferredSportsbook) =>
        set({ preferredSportsbook }),
      setOddsFormat: (oddsFormat) => set({ oddsFormat }),
      setAutoResumePosition: (autoResumePosition) =>
        set({ autoResumePosition }),
      setHomeExpandedSections: (homeExpandedSections) =>
        set({ homeExpandedSections }),
      setGameExpandedSections: (gameExpandedSections) =>
        set({ gameExpandedSections }),
      setHideLimitedData: (hideLimitedData) => set({ hideLimitedData }),
      setShowOnlyPositiveEV: (showOnlyPositiveEV) =>
        set({ showOnlyPositiveEV }),
      setFairbetSortOption: (fairbetSortOption) => set({ fairbetSortOption }),
      toggleHomeSection: (section) => {
        const current = get().homeExpandedSections;
        const next = current.includes(section)
          ? current.filter((s) => s !== section)
          : [...current, section];
        set({ homeExpandedSections: next });
      },
      toggleGameSection: (section) => {
        const current = get().gameExpandedSections;
        const next = current.includes(section)
          ? current.filter((s) => s !== section)
          : [...current, section];
        set({ gameExpandedSections: next });
      },
    }),
    {
      name: "sd-settings",
      version: 1,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        // v0 → v1: empty homeExpandedSections → defaults
        if (
          !state.homeExpandedSections ||
          (Array.isArray(state.homeExpandedSections) &&
            state.homeExpandedSections.length === 0)
        ) {
          state.homeExpandedSections = ["Today", "Yesterday"];
        }
        return state as never;
      },
    },
  ),
);

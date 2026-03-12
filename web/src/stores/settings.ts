import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, DEFAULTS, POLLING } from "@/lib/config";

interface SettingsState {
  theme: "system" | "light" | "dark";
  scoreRevealMode: "always" | "onMarkRead";
  preferredSportsbook: string;
  oddsFormat: "american" | "decimal" | "fractional";
  autoResumePosition: boolean;
  homeExpandedSections: string[];
  hideLimitedData: boolean;
  timelineDefaultTiers: number[];
  followingLive: boolean;
  /** Timestamp (ms) when followingLive was last activated or activity detected. */
  followingLiveAt: number;

  setTheme: (t: "system" | "light" | "dark") => void;
  setScoreRevealMode: (m: "always" | "onMarkRead") => void;
  setPreferredSportsbook: (b: string) => void;
  setOddsFormat: (f: "american" | "decimal" | "fractional") => void;
  setAutoResumePosition: (v: boolean) => void;
  setHomeExpandedSections: (s: string[]) => void;
  setHideLimitedData: (v: boolean) => void;
  setTimelineDefaultTiers: (tiers: number[]) => void;
  toggleTimelineTier: (tier: number) => void;
  toggleHomeSection: (section: string) => void;
  setFollowingLive: (v: boolean) => void;
  touchFollowingLive: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: DEFAULTS.THEME as "system" | "light" | "dark",
      scoreRevealMode: "onMarkRead",
      preferredSportsbook: "",
      oddsFormat: DEFAULTS.ODDS_FORMAT as "american" | "decimal" | "fractional",
      autoResumePosition: true,
      homeExpandedSections: DEFAULTS.HOME_EXPANDED,
      hideLimitedData: true,
      timelineDefaultTiers: DEFAULTS.TIMELINE_TIERS,
      followingLive: false,
      followingLiveAt: 0,

      setTheme: (theme) => set({ theme }),
      setScoreRevealMode: (scoreRevealMode) => set({ scoreRevealMode }),
      setPreferredSportsbook: (preferredSportsbook) =>
        set({ preferredSportsbook }),
      setOddsFormat: (oddsFormat) => set({ oddsFormat }),
      setAutoResumePosition: (autoResumePosition) =>
        set({ autoResumePosition }),
      setHomeExpandedSections: (homeExpandedSections) =>
        set({ homeExpandedSections }),
      setHideLimitedData: (hideLimitedData) => set({ hideLimitedData }),
      setTimelineDefaultTiers: (timelineDefaultTiers) =>
        set({ timelineDefaultTiers }),
      toggleTimelineTier: (tier) => {
        const current = get().timelineDefaultTiers;
        const next = current.includes(tier)
          ? current.filter((t) => t !== tier)
          : [...current, tier].sort();
        set({ timelineDefaultTiers: next });
      },
      toggleHomeSection: (section) => {
        const current = get().homeExpandedSections;
        const next = current.includes(section)
          ? current.filter((s) => s !== section)
          : [...current, section];
        set({ homeExpandedSections: next });
      },
      setFollowingLive: (v) =>
        set({ followingLive: v, followingLiveAt: v ? Date.now() : 0 }),
      touchFollowingLive: () => set({ followingLiveAt: Date.now() }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1) {
          // v0 → v1: empty homeExpandedSections → defaults
          if (
            !state.homeExpandedSections ||
            (Array.isArray(state.homeExpandedSections) &&
              state.homeExpandedSections.length === 0)
          ) {
            state.homeExpandedSections = DEFAULTS.HOME_EXPANDED;
          }
        }
        if (version < 2) {
          // v1 → v2: add followingLive fields
          state.followingLive = false;
          state.followingLiveAt = 0;
        }
        // Auto-expire followingLive if stale
        if (
          state.followingLive &&
          typeof state.followingLiveAt === "number" &&
          state.followingLiveAt > 0 &&
          Date.now() - state.followingLiveAt >= POLLING.FOLLOWING_LIVE_TTL_MS
        ) {
          state.followingLive = false;
          state.followingLiveAt = 0;
        }
        return state as never;
      },
    },
  ),
);

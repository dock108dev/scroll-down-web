import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, DEFAULTS, POLLING } from "@/lib/config";

/* global window, localStorage */

export const SCORE_HIDE_LIMITS = {
  LEAGUES: 20,
  TEAMS: 100,
} as const;

function normalizeLeague(league: string): string {
  return league.trim().toUpperCase();
}

function normalizeTeam(team: string): string {
  return team.trim();
}

function normalizeLeagueList(input: string[]): string[] {
  const unique = new Set<string>();
  for (const value of input) {
    const normalized = normalizeLeague(value);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= SCORE_HIDE_LIMITS.LEAGUES) break;
  }
  return Array.from(unique).sort();
}

function normalizeTeamList(input: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const value of input) {
    const normalized = normalizeTeam(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!byLower.has(key)) {
      byLower.set(key, normalized);
      if (byLower.size >= SCORE_HIDE_LIMITS.TEAMS) break;
    }
  }
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
}

interface SettingsState {
  theme: "system" | "light" | "dark";
  scoreRevealMode: "always" | "onMarkRead" | "blacklist";
  scoreHideLeagues: string[];
  scoreHideTeams: string[];
  preferredSportsbook: string;
  oddsFormat: "american" | "decimal" | "fractional";
  autoResumePosition: boolean;
  homeExpandedSections: string[];
  hideLimitedData: boolean;
  timelineDefaultTiers: number[];
  followingLive: boolean;
  /** Timestamp (ms) when followingLive was last activated or activity detected. */
  followingLiveAt: number;
  /** Admin-only: show banner when displaying stale cached data. */
  showStaleBanners: boolean;

  setTheme: (t: "system" | "light" | "dark") => void;
  setScoreRevealMode: (m: "always" | "onMarkRead" | "blacklist") => void;
  addScoreHideLeague: (league: string) => void;
  removeScoreHideLeague: (league: string) => void;
  setScoreHideLeagues: (leagues: string[]) => void;
  addScoreHideTeam: (team: string) => void;
  removeScoreHideTeam: (team: string) => void;
  setScoreHideTeams: (teams: string[]) => void;
  setPreferredSportsbook: (b: string) => void;
  setOddsFormat: (f: "american" | "decimal" | "fractional") => void;
  setAutoResumePosition: (v: boolean) => void;
  setHomeExpandedSections: (s: string[]) => void;
  setHideLimitedData: (v: boolean) => void;
  setTimelineDefaultTiers: (tiers: number[]) => void;
  toggleTimelineTier: (tier: number) => void;
  toggleHomeSection: (section: string) => void;
  setFollowingLive: (v: boolean, opts?: { preserveTimestamp?: boolean; timestamp?: number }) => void;
  touchFollowingLive: () => void;
  setShowStaleBanners: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: DEFAULTS.THEME as "system" | "light" | "dark",
      scoreRevealMode: "onMarkRead",
      scoreHideLeagues: [],
      scoreHideTeams: [],
      preferredSportsbook: "",
      oddsFormat: DEFAULTS.ODDS_FORMAT as "american" | "decimal" | "fractional",
      autoResumePosition: true,
      homeExpandedSections: DEFAULTS.HOME_EXPANDED,
      hideLimitedData: true,
      timelineDefaultTiers: DEFAULTS.TIMELINE_TIERS,
      followingLive: false,
      followingLiveAt: 0,
      showStaleBanners: true,

      setTheme: (theme) => set({ theme }),
      setScoreRevealMode: (scoreRevealMode) => set({ scoreRevealMode }),
      addScoreHideLeague: (league) => {
        const normalized = normalizeLeague(league);
        if (!normalized) return;
        const current = get().scoreHideLeagues;
        if (current.includes(normalized)) return;
        if (current.length >= SCORE_HIDE_LIMITS.LEAGUES) return;
        set({ scoreHideLeagues: [...current, normalized].sort() });
      },
      removeScoreHideLeague: (league) => {
        const normalized = normalizeLeague(league);
        set((s) => ({
          scoreHideLeagues: s.scoreHideLeagues.filter((v) => v !== normalized),
        }));
      },
      setScoreHideLeagues: (leagues) =>
        set({ scoreHideLeagues: normalizeLeagueList(leagues) }),
      addScoreHideTeam: (team) => {
        const normalized = normalizeTeam(team);
        if (!normalized) return;
        const current = get().scoreHideTeams;
        if (current.some((v) => v.toLowerCase() === normalized.toLowerCase())) return;
        if (current.length >= SCORE_HIDE_LIMITS.TEAMS) return;
        set({ scoreHideTeams: [...current, normalized].sort((a, b) => a.localeCompare(b)) });
      },
      removeScoreHideTeam: (team) => {
        const normalized = normalizeTeam(team).toLowerCase();
        set((s) => ({
          scoreHideTeams: s.scoreHideTeams.filter((v) => v.toLowerCase() !== normalized),
        }));
      },
      setScoreHideTeams: (teams) =>
        set({ scoreHideTeams: normalizeTeamList(teams) }),
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
      setFollowingLive: (v, opts) =>
        set({
          followingLive: v,
          followingLiveAt: v
            ? (typeof opts?.timestamp === "number"
              ? opts.timestamp
              : opts?.preserveTimestamp
                ? get().followingLiveAt
                : Date.now())
            : 0,
        }),
      touchFollowingLive: () => set({ followingLiveAt: Date.now() }),
      setShowStaleBanners: (showStaleBanners) => set({ showStaleBanners }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      version: 4,
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
        if (version < 3) {
          // v2 → v3: add showStaleBanners
          state.showStaleBanners = true;
        }
        if (version < 4) {
          // v3 → v4: add selective score hide lists
          state.scoreHideLeagues = [];
          state.scoreHideTeams = [];
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
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<SettingsState>),
        };
        // Auto-expire stale followingLive on every hydration (migrate only
        // runs on version mismatch, so this covers the same-version case).
        if (
          merged.followingLive &&
          typeof merged.followingLiveAt === "number" &&
          merged.followingLiveAt > 0 &&
          Date.now() - merged.followingLiveAt >= POLLING.FOLLOWING_LIVE_TTL_MS
        ) {
          merged.followingLive = false;
          merged.followingLiveAt = 0;
          // Persist the correction back to localStorage immediately — Zustand
          // persist skips writing during rehydration, so we do it manually.
          try {
            const key = STORAGE_KEYS.SETTINGS;
            const raw = localStorage.getItem(key);
            if (raw) {
              const stored = JSON.parse(raw);
              stored.state.followingLive = false;
              stored.state.followingLiveAt = 0;
              localStorage.setItem(key, JSON.stringify(stored));
            }
          } catch {
            // storage access denied — ignore
          }
        }
        return merged;
      },
    },
  ),
);

// Force-persist defaults on first client hydration so sd-settings is always
// present in localStorage (enables cross-tab sync, debugging, and tests).
if (typeof window !== "undefined") {
  useSettings.persist.onFinishHydration(() => {
    try {
      // setState({}) triggers a persist write without changing values
      useSettings.setState({});
    } catch {
      // SSR or storage access denied — ignore
    }
  });
}

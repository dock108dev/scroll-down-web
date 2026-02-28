import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameStatus } from "@/lib/types";
import { LAYOUT, STORAGE_KEYS, DEFAULTS } from "@/lib/config";

export interface PinnedGameDisplay {
  id: number;
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
}

interface PinnedGamesState {
  pinnedIds: Set<number>;
  displayData: Map<number, PinnedGameDisplay>;
  isPinned: (id: number) => boolean;
  togglePin: (id: number, display?: PinnedGameDisplay) => void;
  pruneStale: (validIds: number[]) => void;
  syncDisplayData: (
    games: { id: number; awayTeamAbbr?: string; homeTeamAbbr?: string; awayScore?: number | null; homeScore?: number | null; status: GameStatus }[],
  ) => void;
}

export const usePinnedGames = create<PinnedGamesState>()(
  persist(
    (set, get) => ({
      pinnedIds: new Set<number>(),
      displayData: new Map<number, PinnedGameDisplay>(),
      isPinned: (id) => get().pinnedIds.has(id),
      togglePin: (id, display?) => {
        set((s) => {
          if (s.pinnedIds.has(id)) {
            const nextIds = new Set(s.pinnedIds);
            nextIds.delete(id);
            const nextDisplay = new Map(s.displayData);
            nextDisplay.delete(id);
            return { pinnedIds: nextIds, displayData: nextDisplay };
          }
          if (s.pinnedIds.size >= LAYOUT.MAX_PINNED_GAMES) return s;
          const nextIds = new Set(s.pinnedIds).add(id);
          const nextDisplay = new Map(s.displayData);
          if (display) nextDisplay.set(id, display);
          return { pinnedIds: nextIds, displayData: nextDisplay };
        });
      },
      pruneStale: (validIds) => {
        const valid = new Set(validIds);
        set((s) => {
          let changed = false;
          const nextIds = new Set<number>();
          const nextDisplay = new Map(s.displayData);
          for (const id of s.pinnedIds) {
            if (valid.has(id)) {
              nextIds.add(id);
            } else {
              changed = true;
              nextDisplay.delete(id);
            }
          }
          return changed ? { pinnedIds: nextIds, displayData: nextDisplay } : s;
        });
      },
      syncDisplayData: (games) => {
        set((s) => {
          const pinned = s.pinnedIds;
          if (pinned.size === 0) return s;
          const nextDisplay = new Map(s.displayData);
          let changed = false;
          for (const g of games) {
            if (!pinned.has(g.id)) continue;
            const existing = nextDisplay.get(g.id);
            const updated: PinnedGameDisplay = {
              id: g.id,
              awayTeamAbbr: g.awayTeamAbbr ?? existing?.awayTeamAbbr ?? DEFAULTS.AWAY_ABBR_FALLBACK,
              homeTeamAbbr: g.homeTeamAbbr ?? existing?.homeTeamAbbr ?? DEFAULTS.HOME_ABBR_FALLBACK,
              awayScore: g.awayScore ?? null,
              homeScore: g.homeScore ?? null,
              status: g.status,
            };
            if (
              !existing ||
              existing.awayScore !== updated.awayScore ||
              existing.homeScore !== updated.homeScore ||
              existing.status !== updated.status ||
              existing.awayTeamAbbr !== updated.awayTeamAbbr ||
              existing.homeTeamAbbr !== updated.homeTeamAbbr
            ) {
              nextDisplay.set(g.id, updated);
              changed = true;
            }
          }
          return changed ? { displayData: nextDisplay } : s;
        });
      },
    }),
    {
      name: STORAGE_KEYS.PINNED_GAMES,
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          parsed.state.pinnedIds = new Set(parsed.state.pinnedIds);
          parsed.state.displayData = new Map(parsed.state.displayData);
          return parsed;
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              pinnedIds: [...value.state.pinnedIds],
              displayData: [...value.state.displayData],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

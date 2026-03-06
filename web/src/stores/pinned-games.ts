import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LAYOUT, STORAGE_KEYS } from "@/lib/config";

/** Minimal display info persisted alongside a pin so the chip renders
 *  even when the full game-data store hasn't loaded yet (e.g. page reload
 *  on the game detail page). */
export interface PinMeta {
  awayTeamAbbr: string;
  homeTeamAbbr: string;
}

interface PinnedGamesState {
  pinnedIds: Set<number>;
  pinMeta: Map<number, PinMeta>;
  isPinned: (id: number) => boolean;
  togglePin: (id: number, meta?: PinMeta) => void;
  pruneStale: (validIds: number[]) => void;
}

export const usePinnedGames = create<PinnedGamesState>()(
  persist(
    (set, get) => ({
      pinnedIds: new Set<number>(),
      pinMeta: new Map<number, PinMeta>(),
      isPinned: (id) => get().pinnedIds.has(id),
      togglePin: (id, meta) => {
        set((s) => {
          if (s.pinnedIds.has(id)) {
            const nextIds = new Set(s.pinnedIds);
            nextIds.delete(id);
            const nextMeta = new Map(s.pinMeta);
            nextMeta.delete(id);
            return { pinnedIds: nextIds, pinMeta: nextMeta };
          }
          if (s.pinnedIds.size >= LAYOUT.MAX_PINNED_GAMES) return s;
          const nextMeta = new Map(s.pinMeta);
          if (meta) nextMeta.set(id, meta);
          return { pinnedIds: new Set(s.pinnedIds).add(id), pinMeta: nextMeta };
        });
      },
      pruneStale: (validIds) => {
        const valid = new Set(validIds);
        set((s) => {
          let changed = false;
          const nextIds = new Set<number>();
          const nextMeta = new Map(s.pinMeta);
          for (const id of s.pinnedIds) {
            if (valid.has(id)) {
              nextIds.add(id);
            } else {
              changed = true;
              nextMeta.delete(id);
            }
          }
          return changed ? { pinnedIds: nextIds, pinMeta: nextMeta } : s;
        });
      },
    }),
    {
      name: STORAGE_KEYS.PINNED_GAMES,
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          // v0/v1 → v2: add empty pinMeta
          delete state.displayData; // clean up legacy field
          if (Array.isArray(state.pinnedIds)) {
            state.pinnedIds = new Set(state.pinnedIds);
          }
          state.pinMeta = new Map();
        }
        return state as never;
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          parsed.state.pinnedIds = new Set(parsed.state.pinnedIds ?? []);
          // Restore pinMeta from serialized array-of-entries
          const raw = parsed.state.pinMeta;
          parsed.state.pinMeta = new Map(Array.isArray(raw) ? raw : []);
          return parsed;
        },
        setItem: (name, value) => {
          const state = value.state as Record<string, unknown>;
          const serialized = {
            ...value,
            state: {
              ...state,
              pinnedIds: [...(state.pinnedIds as Set<number>)],
              pinMeta: [...(state.pinMeta as Map<number, PinMeta>)],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LAYOUT, STORAGE_KEYS } from "@/lib/config";

interface PinnedGamesState {
  pinnedIds: Set<number>;
  isPinned: (id: number) => boolean;
  togglePin: (id: number) => void;
  pruneStale: (validIds: number[]) => void;
}

export const usePinnedGames = create<PinnedGamesState>()(
  persist(
    (set, get) => ({
      pinnedIds: new Set<number>(),
      isPinned: (id) => get().pinnedIds.has(id),
      togglePin: (id) => {
        set((s) => {
          if (s.pinnedIds.has(id)) {
            const nextIds = new Set(s.pinnedIds);
            nextIds.delete(id);
            return { pinnedIds: nextIds };
          }
          if (s.pinnedIds.size >= LAYOUT.MAX_PINNED_GAMES) return s;
          return { pinnedIds: new Set(s.pinnedIds).add(id) };
        });
      },
      pruneStale: (validIds) => {
        const valid = new Set(validIds);
        set((s) => {
          let changed = false;
          const nextIds = new Set<number>();
          for (const id of s.pinnedIds) {
            if (valid.has(id)) {
              nextIds.add(id);
            } else {
              changed = true;
            }
          }
          return changed ? { pinnedIds: nextIds } : s;
        });
      },
    }),
    {
      name: STORAGE_KEYS.PINNED_GAMES,
      version: 1,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        // v0 → v1: drop displayData if present
        if (state.displayData) {
          delete state.displayData;
        }
        // Convert pinnedIds from array to Set if needed
        if (Array.isArray(state.pinnedIds)) {
          state.pinnedIds = new Set(state.pinnedIds);
        }
        return state as never;
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          parsed.state.pinnedIds = new Set(parsed.state.pinnedIds ?? []);
          // Drop displayData from old persisted state
          delete parsed.state.displayData;
          return parsed;
        },
        setItem: (name, value) => {
          const state = value.state as Record<string, unknown>;
          const serialized = {
            ...value,
            state: {
              ...state,
              pinnedIds: [...(state.pinnedIds as Set<number>)],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

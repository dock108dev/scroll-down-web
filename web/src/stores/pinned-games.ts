import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_PINS = 10;

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
            const next = new Set(s.pinnedIds);
            next.delete(id);
            return { pinnedIds: next };
          }
          if (s.pinnedIds.size >= MAX_PINS) return s;
          return { pinnedIds: new Set(s.pinnedIds).add(id) };
        });
      },
      pruneStale: (validIds) => {
        const valid = new Set(validIds);
        set((s) => {
          let changed = false;
          const next = new Set<number>();
          for (const id of s.pinnedIds) {
            if (valid.has(id)) {
              next.add(id);
            } else {
              changed = true;
            }
          }
          return changed ? { pinnedIds: next } : s;
        });
      },
    }),
    {
      name: "sd-pinned-games",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          parsed.state.pinnedIds = new Set(parsed.state.pinnedIds);
          return parsed;
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              pinnedIds: [...value.state.pinnedIds],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

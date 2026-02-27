import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameStatus } from "@/lib/types";

interface ReadState {
  readGameIds: Set<number>;
  isRead: (id: number) => boolean;
  markRead: (id: number, status: GameStatus) => void;
  markUnread: (id: number) => void;
  markAllRead: (ids: number[]) => void;
  markAllUnread: (ids: number[]) => void;
}

export const useReadState = create<ReadState>()(
  persist(
    (set, get) => ({
      readGameIds: new Set<number>(),
      isRead: (id) => get().readGameIds.has(id),
      markRead: (id) => {
        set((s) => ({ readGameIds: new Set(s.readGameIds).add(id) }));
      },
      markUnread: (id) => {
        set((s) => {
          const next = new Set(s.readGameIds);
          next.delete(id);
          return { readGameIds: next };
        });
      },
      markAllRead: (ids) => {
        set((s) => {
          const next = new Set(s.readGameIds);
          ids.forEach((id) => next.add(id));
          return { readGameIds: next };
        });
      },
      markAllUnread: (ids) => {
        set((s) => {
          const next = new Set(s.readGameIds);
          ids.forEach((id) => next.delete(id));
          return { readGameIds: next };
        });
      },
    }),
    {
      name: "sd-read-state",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          parsed.state.readGameIds = new Set(parsed.state.readGameIds);
          return parsed;
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              readGameIds: [...value.state.readGameIds],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

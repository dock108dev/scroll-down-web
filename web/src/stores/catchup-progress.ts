import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE, STORAGE_KEYS } from "@/lib/config";

/**
 * Per-game catch-up progress. `cardIndex` is the index into the rendered card
 * deck the user last saw (0 = scene-setter). `completed` flips once the user
 * tapped through the reveal screen.
 */
export interface CatchupEntry {
  cardIndex: number;
  completed: boolean;
  /** Last play index the client knew about, used as `?since=` for live polls. */
  lastSeenPlayIndex: number;
  updatedAt: number;
}

interface CatchupProgressState {
  entries: Record<number, CatchupEntry>;

  getEntry: (gameId: number) => CatchupEntry | undefined;
  setProgress: (gameId: number, cardIndex: number, lastSeenPlayIndex: number) => void;
  markCompleted: (gameId: number) => void;
  clearAll: () => void;
}

function pruneEntries(
  entries: Record<number, CatchupEntry>,
): Record<number, CatchupEntry> {
  const cutoff = Date.now() - STORAGE.CATCHUP_MAX_AGE_DAYS * 24 * 60 * 60_000;
  const fresh: [number, CatchupEntry][] = Object.entries(entries)
    .map(([id, entry]) => [Number(id), entry] as [number, CatchupEntry])
    .filter(([, entry]) => entry.updatedAt >= cutoff)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, STORAGE.MAX_CATCHUP_ENTRIES);
  return Object.fromEntries(fresh);
}

export const useCatchupProgress = create<CatchupProgressState>()(
  persist(
    (set, get) => ({
      entries: {},

      getEntry: (gameId) => get().entries[gameId],

      setProgress: (gameId, cardIndex, lastSeenPlayIndex) => {
        const prev = get().entries[gameId];
        const next: CatchupEntry = {
          cardIndex,
          completed: prev?.completed ?? false,
          lastSeenPlayIndex,
          updatedAt: Date.now(),
        };
        set({ entries: pruneEntries({ ...get().entries, [gameId]: next }) });
      },

      markCompleted: (gameId) => {
        const prev = get().entries[gameId];
        const next: CatchupEntry = {
          cardIndex: prev?.cardIndex ?? 0,
          lastSeenPlayIndex: prev?.lastSeenPlayIndex ?? -1,
          completed: true,
          updatedAt: Date.now(),
        };
        set({ entries: pruneEntries({ ...get().entries, [gameId]: next }) });
      },

      clearAll: () => set({ entries: {} }),
    }),
    {
      name: STORAGE_KEYS.CATCHUP_STATE,
      version: 1,
      migrate: (persisted: unknown, _version: number) => {
        const state = (persisted ?? {}) as Partial<CatchupProgressState>;
        if (!state.entries || typeof state.entries !== "object") {
          state.entries = {};
        }
        return state as never;
      },
    },
  ),
);

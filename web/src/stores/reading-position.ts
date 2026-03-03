import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, STORAGE } from "@/lib/config";
import { pruneByAge } from "@/lib/storage-bounds";

interface ReadingPosition {
  playIndex: number;
  period?: number;
  gameClock?: string;
  periodLabel?: string;
  timeLabel?: string;
  savedAt: string;
  playCount?: number;
}

interface ReadingPositionState {
  positions: Record<number, ReadingPosition>;
  getPosition: (gameId: number) => ReadingPosition | undefined;
  savePosition: (gameId: number, position: ReadingPosition) => void;
  clearPosition: (gameId: number) => void;
  clearAll: () => void;
}

export const useReadingPosition = create<ReadingPositionState>()(
  persist(
    (set, get) => ({
      positions: {},
      getPosition: (gameId) => get().positions[gameId],
      savePosition: (gameId, position) => {
        set((s) => ({
          positions: { ...s.positions, [gameId]: position },
        }));
      },
      clearPosition: (gameId) => {
        set((s) => {
          const rest = { ...s.positions };
          delete rest[gameId];
          return { positions: rest };
        });
      },
      clearAll: () => set({ positions: {} }),
    }),
    {
      name: STORAGE_KEYS.READING_POSITION,
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Strip score fields from old persisted entries
          const positions = parsed.state?.positions;
          if (positions) {
            for (const key of Object.keys(positions)) {
              delete positions[key].homeScore;
              delete positions[key].awayScore;
            }
          }
          return parsed;
        },
        setItem: (name, value) => {
          const pruned = pruneByAge(
            value.state.positions,
            STORAGE.MAX_READING_POSITIONS,
            STORAGE.POSITION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
          );
          const serialized = {
            ...value,
            state: { ...value.state, positions: pruned },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

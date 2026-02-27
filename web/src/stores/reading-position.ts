import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReadingPosition {
  playIndex: number;
  period?: number;
  gameClock?: string;
  periodLabel?: string;
  timeLabel?: string;
  savedAt: string;
  homeScore?: number;
  awayScore?: number;
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
    { name: "sd-reading-position" },
  ),
);

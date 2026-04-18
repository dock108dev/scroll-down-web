import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, STORAGE } from "@/lib/config";
import { computeCLV } from "@/lib/fairbet-utils";
import type { LoggedBet } from "@/lib/types";

interface MyBetsState {
  bets: LoggedBet[];
  logBet: (bet: Omit<LoggedBet, "id" | "loggedAt">) => void;
  updateClosingOdds: (id: string, closingOdds: number) => void;
  removeBet: (id: string) => void;
  clearAll: () => void;
}

export const useMyBets = create<MyBetsState>()(
  persist(
    (set) => ({
      bets: [],

      logBet: (betData) => {
        const now = new Date();
        const id = `${betData.gameId}::${betData.marketKey}::${betData.selectionDisplay}::${betData.placedOdds}::${now.getTime()}`;
        const bet: LoggedBet = { ...betData, id, loggedAt: now.toISOString() };

        set((state) => {
          const existing = state.bets;
          const updated = [bet, ...existing];
          // FIFO eviction: drop oldest entries beyond the cap
          return { bets: updated.slice(0, STORAGE.MAX_MY_BETS) };
        });
      },

      updateClosingOdds: (id, closingOdds) => {
        set((state) => ({
          bets: state.bets.map((b) => {
            if (b.id !== id) return b;
            const clvPercent = computeCLV(b.placedOdds, closingOdds);
            return {
              ...b,
              closingOdds,
              clvPercent: Number.isFinite(clvPercent) ? clvPercent : undefined,
            };
          }),
        }));
      },

      removeBet: (id) => {
        set((state) => ({ bets: state.bets.filter((b) => b.id !== id) }));
      },

      clearAll: () => set({ bets: [] }),
    }),
    {
      name: STORAGE_KEYS.MY_BETS,
      partialize: (state) => ({ bets: state.bets }),
    },
  ),
);

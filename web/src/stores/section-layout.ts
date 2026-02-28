import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SectionLayoutState {
  /** gameId → list of expanded section names */
  layouts: Record<number, string[]>;
  /** gameId → list of expanded period labels (e.g. "Q1", "Half 2") */
  periods: Record<number, string[]>;
  getLayout: (gameId: number) => string[] | undefined;
  getPeriods: (gameId: number) => string[] | undefined;
  /**
   * Toggle a section for a game. If no layout is saved yet,
   * initializes from `defaults` before toggling.
   */
  toggleSection: (
    gameId: number,
    section: string,
    defaults: string[],
  ) => void;
  /** Toggle a period card open/closed for a game. */
  togglePeriod: (gameId: number, period: string) => void;
  clearLayout: (gameId: number) => void;
  clearAll: () => void;
}

export const useSectionLayout = create<SectionLayoutState>()(
  persist(
    (set, get) => ({
      layouts: {},
      periods: {},
      getLayout: (gameId) => get().layouts[gameId],
      getPeriods: (gameId) => get().periods[gameId],
      toggleSection: (gameId, section, defaults) => {
        const current = get().layouts[gameId] ?? defaults;
        const next = current.includes(section)
          ? current.filter((s) => s !== section)
          : [...current, section];
        set((s) => ({
          layouts: { ...s.layouts, [gameId]: next },
        }));
      },
      togglePeriod: (gameId, period) => {
        const current = get().periods[gameId] ?? [];
        const next = current.includes(period)
          ? current.filter((p) => p !== period)
          : [...current, period];
        set((s) => ({
          periods: { ...s.periods, [gameId]: next },
        }));
      },
      clearLayout: (gameId) => {
        set((s) => {
          const restLayouts = { ...s.layouts };
          const restPeriods = { ...s.periods };
          delete restLayouts[gameId];
          delete restPeriods[gameId];
          return { layouts: restLayouts, periods: restPeriods };
        });
      },
      clearAll: () => set({ layouts: {}, periods: {} }),
    }),
    { name: "sd-section-layout" },
  ),
);

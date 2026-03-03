import { create } from "zustand";

interface HomeScrollState {
  scrollY: number;
  setScrollY: (y: number) => void;
}

export const useHomeScroll = create<HomeScrollState>()((set) => ({
  scrollY: 0,
  setScrollY: (scrollY) => set({ scrollY }),
}));

import { create } from "zustand";

interface UIState {
  settingsOpen: boolean;
  followingLive: boolean;
  liveActivatedAt: number; // timestamp when followingLive was turned on (0 = off)
  openSettings: () => void;
  closeSettings: () => void;
  setFollowingLive: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  settingsOpen: false,
  followingLive: false,
  liveActivatedAt: 0,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setFollowingLive: (followingLive) =>
    set({ followingLive, liveActivatedAt: followingLive ? Date.now() : 0 }),
}));

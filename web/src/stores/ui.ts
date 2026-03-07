import { create } from "zustand";

interface UIState {
  settingsOpen: boolean;
  followingLive: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  setFollowingLive: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  settingsOpen: false,
  followingLive: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setFollowingLive: (followingLive) => set({ followingLive }),
}));

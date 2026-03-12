import { create } from "zustand";

export type SyncState = "idle" | "pulling" | "pushing" | "synced" | "error";

interface SyncStatusState {
  status: SyncState;
  lastSyncedAt: number | null;
  lastError: string | null;
  setStatus: (status: SyncState) => void;
  setError: (error: string) => void;
  setSynced: () => void;
}

export const useSyncStatus = create<SyncStatusState>()((set) => ({
  status: "idle",
  lastSyncedAt: null,
  lastError: null,

  setStatus: (status) => set({ status, lastError: status === "error" ? undefined : null }),

  setError: (error) =>
    set({ status: "error", lastError: error }),

  setSynced: () =>
    set({ status: "synced", lastSyncedAt: Date.now(), lastError: null }),
}));

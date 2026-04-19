import { create } from "zustand";
import { trackEvent } from "@/lib/analytics";
import { STORAGE } from "@/lib/config";
import {
  idbGetRevealState,
  idbSetRevealState,
  idbEnqueueAction,
  idbGetQueue,
  idbClearQueue,
  idbMigrateFromLocalStorage,
  applyQueueEntry,
  enforcedRevealedIds,
  enforcedSnapshots,
} from "@/lib/reveal-idb";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevealSnapshot {
  homeScore: number;
  awayScore: number;
  status: string;
  clock?: string;
  period?: number;
  periodLabel?: string;
  snapshotAt: string;
}

interface RevealState {
  revealedIds: Set<number>;
  snapshots: Map<number, RevealSnapshot>;
  isHydrated: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  reveal: (gameId: number, snapshot: RevealSnapshot) => void;
  acceptUpdate: (gameId: number, snapshot: RevealSnapshot) => void;
  markRead: (gameId: number) => void;
  markReadBatch: (gameIds: number[]) => void;
  hide: (gameId: number) => void;
  revealBatch: (entries: { gameId: number; snapshot: RevealSnapshot }[]) => void;
  hideBatch: (gameIds: number[]) => void;

  // Called by RevealIDBProvider when the browser comes back online
  flushOfflineQueue: () => Promise<void>;

  // Selectors
  isRevealed: (gameId: number) => boolean;
  getSnapshot: (gameId: number) => RevealSnapshot | undefined;
}

// ─── IDB helpers ─────────────────────────────────────────────────────────────

function persistToIDB(
  revealedIds: Set<number>,
  snapshots: Map<number, RevealSnapshot>,
): void {
  if (typeof window === "undefined") return;
  idbSetRevealState({
    id: "main",
    revealedIds: enforcedRevealedIds([...revealedIds]),
    snapshots: enforcedSnapshots([...snapshots]),
  }).catch((err) => {
    console.error("[reveal] idbSetRevealState failed — reveal state may not persist:", err);
  });
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useReveal = create<RevealState>()((set, get) => ({
  revealedIds: new Set<number>(),
  snapshots: new Map<number, RevealSnapshot>(),
  isHydrated: false,

  initialize: async () => {
    if (get().isHydrated) return;
    if (typeof window === "undefined") return;

    // One-time migration from localStorage (idempotent)
    await idbMigrateFromLocalStorage();

    // Load persisted state + pending offline queue
    const stored = await idbGetRevealState();
    const queue = await idbGetQueue();

    const mutable: {
      revealedIds: number[];
      snapshots: [number, RevealSnapshot][];
    } = {
      revealedIds: stored?.revealedIds ?? [],
      snapshots: stored?.snapshots ?? [],
    };

    for (const entry of queue) {
      applyQueueEntry(mutable, entry);
    }

    set({
      revealedIds: new Set(mutable.revealedIds),
      snapshots: new Map(mutable.snapshots),
      isHydrated: true,
    });
  },

  reveal: (gameId, snapshot) => {
    if (!get().revealedIds.has(gameId)) {
      trackEvent("reveal_score", { gameId: String(gameId) });
    }
    set((s) => ({
      revealedIds: new Set(s.revealedIds).add(gameId),
      snapshots: new Map(s.snapshots).set(gameId, snapshot),
    }));
    if (isOffline()) {
      idbEnqueueAction({
        action: "reveal",
        gameId,
        snapshot,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(reveal) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  acceptUpdate: (gameId, snapshot) => {
    set((s) => ({
      snapshots: new Map(s.snapshots).set(gameId, snapshot),
    }));
    if (isOffline()) {
      idbEnqueueAction({
        action: "acceptUpdate",
        gameId,
        snapshot,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(acceptUpdate) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  markRead: (gameId) => {
    set((s) => ({
      revealedIds: new Set(s.revealedIds).add(gameId),
    }));
    if (isOffline()) {
      idbEnqueueAction({
        action: "markRead",
        gameId,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(markRead) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  markReadBatch: (gameIds) => {
    set((s) => {
      const next = new Set(s.revealedIds);
      for (const id of gameIds) next.add(id);
      return { revealedIds: next };
    });
    if (isOffline()) {
      idbEnqueueAction({
        action: "markReadBatch",
        gameIds,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(markReadBatch) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  hide: (gameId) => {
    set((s) => {
      const next = new Set(s.revealedIds);
      next.delete(gameId);
      return { revealedIds: next };
    });
    if (isOffline()) {
      idbEnqueueAction({
        action: "hide",
        gameId,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(hide) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  revealBatch: (entries) => {
    set((s) => {
      const nextIds = new Set(s.revealedIds);
      const nextSnaps = new Map(s.snapshots);
      for (const { gameId, snapshot } of entries) {
        nextIds.add(gameId);
        nextSnaps.set(gameId, snapshot);
      }
      return { revealedIds: nextIds, snapshots: nextSnaps };
    });
    if (isOffline()) {
      idbEnqueueAction({
        action: "revealBatch",
        entries,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(revealBatch) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  hideBatch: (gameIds) => {
    set((s) => {
      const nextIds = new Set(s.revealedIds);
      for (const id of gameIds) nextIds.delete(id);
      return { revealedIds: nextIds };
    });
    if (isOffline()) {
      idbEnqueueAction({
        action: "hideBatch",
        gameIds,
        queuedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[reveal] idbEnqueueAction(hideBatch) failed:", err);
      });
    } else {
      persistToIDB(get().revealedIds, get().snapshots);
    }
  },

  flushOfflineQueue: async () => {
    if (typeof window === "undefined") return;
    const { revealedIds, snapshots } = get();
    await idbSetRevealState({
      id: "main",
      revealedIds: enforcedRevealedIds([...revealedIds]),
      snapshots: enforcedSnapshots([...snapshots]),
    });
    await idbClearQueue();
  },

  isRevealed: (gameId) => get().revealedIds.has(gameId),
  getSnapshot: (gameId) => get().snapshots.get(gameId),
}));

// ─── Cap constants re-export for consumers ───────────────────────────────────

export const REVEAL_CAPS = {
  MAX_REVEALED_IDS: STORAGE.MAX_REVEALED_IDS,
  MAX_SNAPSHOTS: STORAGE.MAX_SNAPSHOTS,
} as const;

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, STORAGE } from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────

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

  // Actions
  reveal: (gameId: number, snapshot: RevealSnapshot) => void;
  acceptUpdate: (gameId: number, snapshot: RevealSnapshot) => void;
  markRead: (gameId: number) => void;
  hide: (gameId: number) => void;
  revealBatch: (entries: { gameId: number; snapshot: RevealSnapshot }[]) => void;
  hideBatch: (gameIds: number[]) => void;

  // Selectors
  isRevealed: (gameId: number) => boolean;
  getSnapshot: (gameId: number) => RevealSnapshot | undefined;
}

// ─── Store ────────────────────────────────────────────────────────

export const useReveal = create<RevealState>()(
  persist(
    (set, get) => ({
      revealedIds: new Set<number>(),
      snapshots: new Map<number, RevealSnapshot>(),

      reveal: (gameId, snapshot) => {
        set((s) => ({
          revealedIds: new Set(s.revealedIds).add(gameId),
          snapshots: new Map(s.snapshots).set(gameId, snapshot),
        }));
      },

      acceptUpdate: (gameId, snapshot) => {
        set((s) => ({
          snapshots: new Map(s.snapshots).set(gameId, snapshot),
        }));
      },

      markRead: (gameId) => {
        set((s) => ({
          revealedIds: new Set(s.revealedIds).add(gameId),
        }));
      },

      hide: (gameId) => {
        set((s) => {
          const next = new Set(s.revealedIds);
          next.delete(gameId);
          // Keep snapshot for quick re-reveal
          return { revealedIds: next };
        });
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
      },

      hideBatch: (gameIds) => {
        set((s) => {
          const nextIds = new Set(s.revealedIds);
          for (const id of gameIds) {
            nextIds.delete(id);
          }
          // Keep snapshots for quick re-reveal
          return { revealedIds: nextIds };
        });
      },

      isRevealed: (gameId) => get().revealedIds.has(gameId),
      getSnapshot: (gameId) => get().snapshots.get(gameId),
    }),
    {
      name: STORAGE_KEYS.READ_STATE,
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 || !version) {
          // v0 → v1: old format had readGameIds: number[]
          const oldIds = state.readGameIds as number[] | undefined;
          if (oldIds) {
            return {
              revealedIds: new Set(oldIds),
              snapshots: new Map<number, RevealSnapshot>(),
            } as never;
          }
        }
        return state as never;
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          const s = parsed.state;
          // Deserialize Set and Map from arrays
          s.revealedIds = new Set(s.revealedIds ?? []);
          s.snapshots = new Map(
            Array.isArray(s.snapshots) ? s.snapshots : [],
          );
          return parsed;
        },
        setItem: (name, value) => {
          const s = value.state as Record<string, unknown>;
          const snapMap = s.snapshots as Map<number, RevealSnapshot>;
          const revSet = s.revealedIds as Set<number>;
          // Cap snapshot entries to prevent unbounded growth
          let snapshotEntries = [...snapMap];
          if (snapshotEntries.length > STORAGE.MAX_SNAPSHOTS) {
            snapshotEntries.sort(
              (a, b) =>
                new Date(b[1].snapshotAt).getTime() -
                new Date(a[1].snapshotAt).getTime(),
            );
            snapshotEntries = snapshotEntries.slice(0, STORAGE.MAX_SNAPSHOTS);
          }
          // Cap revealed IDs
          let revealedArr = [...revSet];
          if (revealedArr.length > STORAGE.MAX_REVEALED_IDS) {
            revealedArr = revealedArr.slice(-STORAGE.MAX_REVEALED_IDS);
          }
          const serialized = {
            ...value,
            state: {
              ...s,
              revealedIds: revealedArr,
              snapshots: snapshotEntries,
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

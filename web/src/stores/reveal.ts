import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, STORAGE } from "@/lib/config";
import { trackEvent } from "@/lib/analytics";
import { isTerminal } from "@/lib/game-state";
import type { GameState } from "@/lib/game-state";
import { useSettings } from "@/stores/settings";
import { useGameData } from "@/stores/game-data";
import { isGameHiddenByBlacklist } from "@/lib/score-hide";

// ─── Types ────────────────────────────────────────────────────────

export interface RevealSnapshot {
  homeScore: number;
  awayScore: number;
  status: string;
  clock?: string;
  period?: number;
  periodLabel?: string;
  snapshotAt: string;
  isFrozen: boolean;
}

interface RevealState {
  revealedIds: Set<number>;
  snapshots: Map<number, RevealSnapshot>;
  dailyRevealCount: number;
  dailyRevealDate: string;

  // Actions
  reveal: (gameId: number, snapshot: RevealSnapshot) => void;
  acceptUpdate: (gameId: number, snapshot: RevealSnapshot) => void;
  markRead: (gameId: number) => void;
  hide: (gameId: number) => void;
  revealBatch: (entries: { gameId: number; snapshot: RevealSnapshot }[]) => void;
  hideBatch: (gameIds: number[]) => void;
  resetDailyCountIfStale: () => void;

  // Selectors
  isRevealed: (gameId: number) => boolean;
  getSnapshot: (gameId: number) => RevealSnapshot | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function snapshotAgeHours(snap: RevealSnapshot): number {
  return (Date.now() - new Date(snap.snapshotAt).getTime()) / (1000 * 60 * 60);
}

function revealedIdAgeMs(snapshotAt: string): number {
  return Date.now() - new Date(snapshotAt).getTime();
}

// ─── Store ────────────────────────────────────────────────────────

export const useReveal = create<RevealState>()(
  persist(
    (set, get) => ({
      revealedIds: new Set<number>(),
      snapshots: new Map<number, RevealSnapshot>(),
      dailyRevealCount: 0,
      dailyRevealDate: todayISO(),

      reveal: (gameId, snapshot) => {
        const state = get();
        const isNew = !state.revealedIds.has(gameId);
        if (isNew) {
          trackEvent("reveal_score", { gameId: String(gameId) });
        }

        let { dailyRevealCount, dailyRevealDate } = state;
        if (dailyRevealDate !== todayISO()) {
          dailyRevealCount = 0;
          dailyRevealDate = todayISO();
        }
        if (isNew) {
          dailyRevealCount++;
        }

        set({
          revealedIds: new Set(state.revealedIds).add(gameId),
          snapshots: new Map(state.snapshots).set(gameId, snapshot),
          dailyRevealCount,
          dailyRevealDate,
        });
      },

      acceptUpdate: (gameId, snapshot) => {
        const existing = get().snapshots.get(gameId);
        if (existing?.isFrozen) return;

        const frozen = isTerminal(snapshot.status as GameState);
        set((s) => ({
          snapshots: new Map(s.snapshots).set(gameId, {
            ...snapshot,
            isFrozen: frozen,
          }),
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
          return { revealedIds: nextIds };
        });
      },

      resetDailyCountIfStale: () => {
        const today = todayISO();
        if (get().dailyRevealDate !== today) {
          set({ dailyRevealCount: 0, dailyRevealDate: today });
        }
      },

      isRevealed: (gameId) => {
        const settings = useSettings.getState();

        if (settings.followingLive) return true;
        if (settings.scoreRevealMode === "always") return true;

        if (settings.scoreRevealMode === "blacklist") {
          const core = useGameData.getState().getCore(gameId);
          if (core) {
            const hidden = isGameHiddenByBlacklist(
              core,
              settings.scoreHideLeagues,
              settings.scoreHideTeams,
            );
            if (!hidden) return true;
          }
        }

        return get().revealedIds.has(gameId);
      },

      getSnapshot: (gameId) => get().snapshots.get(gameId),
    }),
    {
      name: STORAGE_KEYS.READ_STATE,
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 || !version) {
          const oldIds = state.readGameIds as number[] | undefined;
          if (oldIds) {
            return {
              revealedIds: new Set(oldIds),
              snapshots: new Map<number, RevealSnapshot>(),
              dailyRevealCount: 0,
              dailyRevealDate: todayISO(),
            } as never;
          }
        }
        if ((version ?? 0) < 2) {
          state.dailyRevealCount = (state.dailyRevealCount as number) ?? 0;
          state.dailyRevealDate = (state.dailyRevealDate as string) ?? todayISO();
          // Backfill isFrozen on existing snapshots
          const snapshots = state.snapshots;
          if (snapshots instanceof Map) {
            for (const [, snap] of snapshots) {
              const s = snap as RevealSnapshot;
              if (s.isFrozen === undefined) {
                s.isFrozen = isTerminal((s.status ?? "scheduled") as GameState);
              }
            }
          } else if (Array.isArray(snapshots)) {
            for (const entry of snapshots as [number, RevealSnapshot][]) {
              if (entry[1].isFrozen === undefined) {
                entry[1].isFrozen = isTerminal(
                  (entry[1].status ?? "scheduled") as GameState,
                );
              }
            }
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
          s.revealedIds = new Set(s.revealedIds ?? []);
          s.snapshots = new Map(
            Array.isArray(s.snapshots) ? s.snapshots : [],
          );
          s.dailyRevealCount = s.dailyRevealCount ?? 0;
          s.dailyRevealDate = s.dailyRevealDate ?? todayISO();
          return parsed;
        },
        setItem: (name, value) => {
          const s = value.state as Record<string, unknown>;
          const snapMap = s.snapshots as Map<number, RevealSnapshot>;
          const revSet = s.revealedIds as Set<number>;

          const ttlMs = STORAGE.REVEALED_IDS_TTL_DAYS * 24 * 60 * 60 * 1000;

          // Prune snapshots: drop post-final snapshots older than 72h, then cap
          let snapshotEntries = [...snapMap].filter(([, snap]) => {
            if (snap.isFrozen && snapshotAgeHours(snap) > STORAGE.SNAPSHOT_POST_FINAL_TTL_HOURS) {
              return false;
            }
            return true;
          });
          if (snapshotEntries.length > STORAGE.MAX_SNAPSHOTS) {
            snapshotEntries.sort(
              (a, b) =>
                new Date(b[1].snapshotAt).getTime() -
                new Date(a[1].snapshotAt).getTime(),
            );
            snapshotEntries = snapshotEntries.slice(0, STORAGE.MAX_SNAPSHOTS);
          }

          // Build a lookup for snapshot timestamps to prune revealed IDs by TTL
          const snapLookup = new Map(snapshotEntries);
          let revealedArr = [...revSet].filter((id) => {
            const snap = snapLookup.get(id);
            if (snap) {
              return revealedIdAgeMs(snap.snapshotAt) < ttlMs;
            }
            return true;
          });

          if (revealedArr.length > STORAGE.MAX_REVEALED_IDS) {
            revealedArr = revealedArr.slice(-STORAGE.MAX_REVEALED_IDS);
          }

          const serialized = {
            ...value,
            state: {
              ...s,
              revealedIds: revealedArr,
              snapshots: snapshotEntries,
              dailyRevealCount: s.dailyRevealCount ?? 0,
              dailyRevealDate: s.dailyRevealDate ?? todayISO(),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

// Reset daily counter on hydration
if (typeof window !== "undefined") {
  useReveal.persist.onFinishHydration(() => {
    try {
      useReveal.getState().resetDailyCountIfStale();
    } catch {
      // SSR or storage access denied
    }
  });
}

/**
 * Raw IndexedDB persistence for reveal state and the offline action queue.
 * No Dexie or external package — uses the native IDB API directly.
 *
 * DB layout:
 *   "scroll-down"  v1
 *   ├── revealState  { keyPath: "id" }   — single record keyed "main"
 *   └── syncQueue   { keyPath: "id", autoIncrement }  — offline action log
 */

import type { RevealSnapshot } from "@/stores/reveal";
import { STORAGE, STORAGE_KEYS } from "@/lib/config";

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = "scroll-down";
const DB_VERSION = 1;
const STORE_REVEAL = "revealState";
const STORE_QUEUE = "syncQueue";
const REVEAL_KEY = "main";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredRevealState {
  id: "main";
  revealedIds: number[];
  snapshots: [number, RevealSnapshot][];
}

export interface SyncQueueEntry {
  id?: number; // autoIncrement — set by IDB on write
  action:
    | "reveal"
    | "acceptUpdate"
    | "markRead"
    | "markReadBatch"
    | "hide"
    | "revealBatch"
    | "hideBatch";
  gameId?: number;
  snapshot?: RevealSnapshot;
  gameIds?: number[];
  entries?: { gameId: number; snapshot: RevealSnapshot }[];
  queuedAt: string;
}

// ─── DB open ──────────────────────────────────────────────────────────────────

let _db: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  _db = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_REVEAL)) {
        db.createObjectStore(STORE_REVEAL, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => {
      _db = null; // allow retry on next call
      reject(req.error);
    };
  });
  return _db;
}

// ─── Reveal state CRUD ────────────────────────────────────────────────────────

export async function idbGetRevealState(): Promise<StoredRevealState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REVEAL, "readonly");
    const req = tx.objectStore(STORE_REVEAL).get(REVEAL_KEY);
    req.onsuccess = () => resolve((req.result as StoredRevealState) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetRevealState(
  state: StoredRevealState,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REVEAL, "readwrite");
    const req = tx.objectStore(STORE_REVEAL).put(state);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Sync queue ───────────────────────────────────────────────────────────────

export async function idbEnqueueAction(
  entry: Omit<SyncQueueEntry, "id">,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const req = tx.objectStore(STORE_QUEUE).add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetQueue(): Promise<SyncQueueEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result as SyncQueueEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbClearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const req = tx.objectStore(STORE_QUEUE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Cap enforcement ─────────────────────────────────────────────────────────

export function enforcedRevealedIds(ids: number[]): number[] {
  if (ids.length <= STORAGE.MAX_REVEALED_IDS) return ids;
  return ids.slice(-STORAGE.MAX_REVEALED_IDS);
}

export function enforcedSnapshots(
  snaps: [number, RevealSnapshot][],
): [number, RevealSnapshot][] {
  if (snaps.length <= STORAGE.MAX_SNAPSHOTS) return snaps;
  return [...snaps]
    .sort(
      (a, b) =>
        new Date(b[1].snapshotAt).getTime() -
        new Date(a[1].snapshotAt).getTime(),
    )
    .slice(0, STORAGE.MAX_SNAPSHOTS);
}

// ─── Queue-entry replay ───────────────────────────────────────────────────────

/**
 * Applies a single offline queue entry to a mutable plain-object state.
 * Caps are enforced after applying each entry.
 */
export function applyQueueEntry(
  state: { revealedIds: number[]; snapshots: [number, RevealSnapshot][] },
  entry: SyncQueueEntry,
): void {
  switch (entry.action) {
    case "reveal":
    case "acceptUpdate": {
      if (entry.gameId == null || !entry.snapshot) return;
      if (!state.revealedIds.includes(entry.gameId)) {
        state.revealedIds.push(entry.gameId);
      }
      const snapIdx = state.snapshots.findIndex(
        ([id]) => id === entry.gameId,
      );
      if (snapIdx >= 0) {
        state.snapshots[snapIdx] = [entry.gameId, entry.snapshot];
      } else {
        state.snapshots.push([entry.gameId, entry.snapshot]);
      }
      break;
    }
    case "markRead": {
      if (entry.gameId == null) return;
      if (!state.revealedIds.includes(entry.gameId)) {
        state.revealedIds.push(entry.gameId);
      }
      break;
    }
    case "markReadBatch": {
      if (!entry.gameIds) return;
      const idSet = new Set(state.revealedIds);
      for (const id of entry.gameIds) idSet.add(id);
      state.revealedIds = [...idSet];
      break;
    }
    case "revealBatch": {
      if (!entry.entries) return;
      const idSet = new Set(state.revealedIds);
      const snapMap = new Map(state.snapshots);
      for (const { gameId, snapshot } of entry.entries) {
        idSet.add(gameId);
        snapMap.set(gameId, snapshot);
      }
      state.revealedIds = [...idSet];
      state.snapshots = [...snapMap];
      break;
    }
    case "hide": {
      if (entry.gameId == null) return;
      state.revealedIds = state.revealedIds.filter(
        (id) => id !== entry.gameId,
      );
      break;
    }
    case "hideBatch": {
      if (!entry.gameIds) return;
      const hideSet = new Set(entry.gameIds);
      state.revealedIds = state.revealedIds.filter(
        (id) => !hideSet.has(id),
      );
      break;
    }
  }

  // Enforce caps after each entry
  state.revealedIds = enforcedRevealedIds(state.revealedIds);
  state.snapshots = enforcedSnapshots(state.snapshots);
}

// ─── localStorage → IDB migration ────────────────────────────────────────────

/**
 * One-time, idempotent migration.
 * Copies existing sd-read-state localStorage data into IDB revealState, then
 * removes the localStorage key. Safe to call on every app start — if
 * localStorage is already cleared there is nothing to migrate.
 */
export async function idbMigrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem(STORAGE_KEYS.READ_STATE);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as {
      state?: {
        revealedIds?: number[];
        snapshots?: [number, RevealSnapshot][];
      };
    };
    const s = parsed?.state;

    const revealedIds: number[] = Array.isArray(s?.revealedIds)
      ? s.revealedIds
      : [];
    const snapshots: [number, RevealSnapshot][] = Array.isArray(s?.snapshots)
      ? s.snapshots
      : [];

    // Only write to IDB if there is no existing record — prevents overwriting
    // newer IDB data in the unlikely event localStorage was not yet removed.
    const existing = await idbGetRevealState();
    if (!existing) {
      await idbSetRevealState({
        id: "main",
        revealedIds: enforcedRevealedIds(revealedIds),
        snapshots: enforcedSnapshots(snapshots),
      });
    }
  } catch {
    // Malformed localStorage data — discard and continue
  } finally {
    localStorage.removeItem(STORAGE_KEYS.READ_STATE);
  }
}

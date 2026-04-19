/**
 * Cross-device reveal state sync for Pro users.
 *
 * Pulls remote reveal state on login and polls every 25 seconds.
 * Pushes local changes (debounced 2s) after any reveal action.
 * No-op for free / anonymous users — guarded by CROSS_DEVICE_SYNC feature gate.
 * All failures are silent — local IndexedDB state is always preserved.
 */

import { useReveal } from "@/stores/reveal";
import { useTier } from "@/stores/tier";
import { FEATURE_GATES } from "@/lib/config";
import type { RevealSnapshot } from "@/stores/reveal";

const TAG = "[reveal-sync]";
const SYNC_INTERVAL_MS = 25_000;
const PUSH_DEBOUNCE_MS = 2_000;

// ─── State ────────────────────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubReveal: (() => void) | null = null;
let isMerging = false;

// ─── Gate ─────────────────────────────────────────────────────────────────────

function isProUser(): boolean {
  return useTier.getState().isAllowed(FEATURE_GATES.CROSS_DEVICE_SYNC);
}

// ─── API ──────────────────────────────────────────────────────────────────────

interface SyncResponse {
  revealedIds: number[];
  snapshots: Record<string, RevealSnapshot>;
  updatedAt: string;
}

async function fetchRemoteState(): Promise<SyncResponse | null> {
  try {
    const res = await fetch("/api/sync/reveal", { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as SyncResponse;
  } catch (err) {
    console.warn(`${TAG} fetchRemoteState network error (non-fatal):`, err);
    return null;
  }
}

async function pushLocalState(): Promise<void> {
  const { revealedIds, snapshots } = useReveal.getState();
  try {
    await fetch("/api/sync/reveal", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revealedIds: [...revealedIds],
        snapshots: Object.fromEntries(snapshots),
      }),
    });
  } catch {
    // Silent — local IDB state is preserved; sync retries on next interval
  }
}

// ─── Merge ────────────────────────────────────────────────────────────────────

function mergeRemoteState(remote: SyncResponse): void {
  const revealStore = useReveal.getState();

  const toReveal = remote.revealedIds.filter(
    (id) => !revealStore.revealedIds.has(id),
  );
  if (toReveal.length === 0) return;

  isMerging = true;
  try {
    revealStore.revealBatch(
      toReveal.map((gameId) => {
        const remotSnap = remote.snapshots[String(gameId)];
        const localSnap = revealStore.getSnapshot(gameId);
        let snapshot: RevealSnapshot;
        if (remotSnap && localSnap) {
          snapshot =
            remotSnap.snapshotAt > localSnap.snapshotAt ? remotSnap : localSnap;
        } else {
          snapshot = remotSnap ??
            localSnap ?? {
              homeScore: 0,
              awayScore: 0,
              status: "unknown",
              snapshotAt: new Date().toISOString(),
            };
        }
        return { gameId, snapshot };
      }),
    );
  } finally {
    isMerging = false;
  }
}

// ─── Pull + push scheduling ───────────────────────────────────────────────────

async function pullAndMerge(): Promise<void> {
  if (!isProUser()) return;
  try {
    const remote = await fetchRemoteState();
    if (remote) mergeRemoteState(remote);
  } catch (err) {
    console.warn(`${TAG} pullAndMerge error (non-fatal):`, err);
  }
}

function schedulePush(): void {
  if (isMerging) return;
  if (!isProUser()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushLocalState().catch((err) => {
      console.warn(`${TAG} pushLocalState error (non-fatal):`, err);
    });
  }, PUSH_DEBOUNCE_MS);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function startRevealSync(): void {
  stopRevealSync();

  if (!isProUser()) return;

  pullAndMerge().catch(() => {});

  syncTimer = setInterval(() => {
    pullAndMerge().catch(() => {});
  }, SYNC_INTERVAL_MS);

  unsubReveal = useReveal.subscribe(schedulePush);
}

export function stopRevealSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (unsubReveal) {
    unsubReveal();
    unsubReveal = null;
  }
}

/**
 * Immediately push current reveal state (e.g., before tab close).
 * No-op for non-Pro users.
 */
export async function flushRevealSync(): Promise<void> {
  if (!isProUser()) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushLocalState();
}

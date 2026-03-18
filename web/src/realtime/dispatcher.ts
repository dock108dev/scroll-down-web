/**
 * Centralized realtime event dispatcher.
 * Exactly ONE onMessage handler registered globally.
 * Routes events into the Zustand store with seq/gap handling + throttled recovery.
 */

import { getTransport } from "./transport";
import type { RealtimeEvent } from "./transport";
import { useGameData } from "@/stores/game-data";
import type { GameCore } from "@/stores/game-data";
import type { PlayEntry } from "@/lib/types";
import { REALTIME } from "@/lib/config";

// ── Module-level guards ─────────────────────────────────────────

let initialized = false;

// Throttle recovery per channel to prevent storms from rapid gap detections
const lastRecoveryAt = new Map<string, number>();

function canRecover(channel: string): boolean {
  const last = lastRecoveryAt.get(channel) ?? 0;
  const now = Date.now();
  if (now - last < REALTIME.RECOVERY_MIN_INTERVAL_MS) return false;
  lastRecoveryAt.set(channel, now);
  return true;
}

// ── Channel pattern helpers ─────────────────────────────────────

function parseGameId(raw: string): number {
  const n = Number(raw);
  return isNaN(n) ? 0 : n;
}

function extractListKey(channel: string): string | null {
  // channel: "games:nba:2026-03-05" → listKey "nba:2026-03-05" or the full channel
  if (channel.startsWith("games:")) return channel;
  return null;
}

function extractGameIdFromChannel(channel: string): number | null {
  // channel: "game:12345:summary" or "game:12345:pbp"
  const match = channel.match(/^game:(\d+):/);
  return match ? Number(match[1]) : null;
}

// ── Recovery triggers ───────────────────────────────────────────

function triggerRecovery(channel: string): void {
  if (!canRecover(channel)) return;

  const store = useGameData.getState();

  const listKey = extractListKey(channel);
  if (listKey) {
    store.requestListRefresh(listKey);
    return;
  }

  if (channel.includes(":summary")) {
    const gameId = extractGameIdFromChannel(channel);
    if (gameId) store.requestGameRefresh(gameId);
    return;
  }

  if (channel.includes(":pbp")) {
    const gameId = extractGameIdFromChannel(channel);
    if (gameId) store.requestPbpRefresh(gameId);
    return;
  }

  if (channel.startsWith("fairbet:")) {
    store.requestFairbetRefresh();
    return;
  }
}

// ── Event handler ───────────────────────────────────────────────

function handleEvent(event: RealtimeEvent): void {
  const store = useGameData.getState();

  // Check seq without committing
  const seqResult = store.checkSeq(event.channel, event.seq);

  if (seqResult === "duplicate") return;

  if (seqResult === "gap") {
    store.markDesynced(event.channel, true);
    triggerRecovery(event.channel);
    // Do NOT commit seq — recovery will re-sync
    return;
  }

  // Normal: commit seq, apply event, clear desync
  store.commitSeq(event.channel, event.seq);
  store.markDesynced(event.channel, false);

  switch (event.type) {
    case "game_patch": {
      const gameId = parseGameId(event.gameId);
      if (gameId) {
        // applyGamePatch creates a minimal entry for games not yet in the store
        store.applyGamePatch(gameId, event.patch as Partial<GameCore>);
      }
      break;
    }
    case "pbp_append": {
      const gameId = parseGameId(event.gameId);
      if (gameId) {
        store.appendPbp(gameId, event.events as unknown as PlayEntry[]);
      }
      break;
    }
    case "fairbet_patch": {
      // FairBet data is hook-local / in-memory — set flag for hook to pick up
      store.requestFairbetRefresh();
      break;
    }
  }
}

// ── Public init ─────────────────────────────────────────────────

export function initRealtimeDispatcher(): void {
  if (initialized) return;
  initialized = true;

  const transport = getTransport();
  transport.onMessage(handleEvent);
}

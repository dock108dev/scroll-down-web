import "fake-indexeddb/auto";

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RevealSnapshot } from "@/stores/reveal";
import { STORAGE_KEYS } from "@/lib/config";

function snap(): RevealSnapshot {
  return {
    homeScore: 0,
    awayScore: 0,
    status: "final",
    snapshotAt: "2026-04-01T12:00:00.000Z",
  };
}

describe("reveal-idb IndexedDB", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("covers openDB, reveal CRUD, queue, migration branches, and reuse", async () => {
    localStorage.setItem(
      STORAGE_KEYS.READ_STATE,
      JSON.stringify({
        state: {
          revealedIds: [7],
          snapshots: [[7, snap()]],
        },
      }),
    );

    const mod = await import("@/lib/reveal-idb");
    await mod.idbMigrateFromLocalStorage();
    expect(localStorage.getItem(STORAGE_KEYS.READ_STATE)).toBeNull();
    expect((await mod.idbGetRevealState())?.revealedIds).toContain(7);

    await mod.idbSetRevealState({
      id: "main",
      revealedIds: [1, 2],
      snapshots: [[1, snap()]],
    });
    expect((await mod.idbGetRevealState())?.revealedIds).toEqual([1, 2]);

    await mod.idbEnqueueAction({
      action: "markRead",
      gameId: 42,
      queuedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(await mod.idbGetQueue()).toHaveLength(1);
    await mod.idbClearQueue();
    expect(await mod.idbGetQueue()).toHaveLength(0);

    localStorage.setItem(
      STORAGE_KEYS.READ_STATE,
      JSON.stringify({ state: { revealedIds: [200], snapshots: [] } }),
    );
    await mod.idbMigrateFromLocalStorage();
    expect((await mod.idbGetRevealState())?.revealedIds).toEqual([1, 2]);
    expect(localStorage.getItem(STORAGE_KEYS.READ_STATE)).toBeNull();

    localStorage.setItem(STORAGE_KEYS.READ_STATE, "{");
    await mod.idbMigrateFromLocalStorage();
    expect(localStorage.getItem(STORAGE_KEYS.READ_STATE)).toBeNull();

    await mod.idbGetRevealState();
    await mod.idbGetQueue();
  });
});

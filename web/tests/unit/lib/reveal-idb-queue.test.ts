import { describe, it, expect } from "vitest";
import type { RevealSnapshot } from "@/stores/reveal";
import {
  enforcedRevealedIds,
  enforcedSnapshots,
  applyQueueEntry,
} from "@/lib/reveal-idb";
import { STORAGE } from "@/lib/config";

function snap(t: string): RevealSnapshot {
  return {
    homeScore: 1,
    awayScore: 0,
    status: "final",
    snapshotAt: t,
  };
}

describe("reveal-idb caps", () => {
  it("truncates revealed id list", () => {
    const ids = Array.from({ length: STORAGE.MAX_REVEALED_IDS + 10 }, (_, i) => i);
    const out = enforcedRevealedIds(ids);
    expect(out.length).toBe(STORAGE.MAX_REVEALED_IDS);
    expect(out[0]).toBe(10);
  });

  it("keeps newest snapshots when over cap", () => {
    const rows: [number, RevealSnapshot][] = [];
    for (let i = 0; i < STORAGE.MAX_SNAPSHOTS + 5; i++) {
      rows.push([i, snap(`2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`)]);
    }
    const out = enforcedSnapshots(rows);
    expect(out.length).toBe(STORAGE.MAX_SNAPSHOTS);
  });
});

describe("applyQueueEntry", () => {
  it("handles reveal and acceptUpdate", () => {
    const state = { revealedIds: [] as number[], snapshots: [] as [number, RevealSnapshot][] };
    applyQueueEntry(state, {
      action: "reveal",
      gameId: 1,
      snapshot: snap("2026-01-01T00:00:00.000Z"),
      queuedAt: "t",
    });
    expect(state.revealedIds).toContain(1);
    applyQueueEntry(state, {
      action: "acceptUpdate",
      gameId: 1,
      snapshot: snap("2026-01-02T00:00:00.000Z"),
      queuedAt: "t",
    });
    expect(state.snapshots[0][1].snapshotAt).toContain("2026-01-02");
  });

  it("ignores invalid reveal rows", () => {
    const state = { revealedIds: [] as number[], snapshots: [] as [number, RevealSnapshot][] };
    applyQueueEntry(state, { action: "reveal", queuedAt: "t" });
    expect(state.revealedIds.length).toBe(0);
  });

  it("handles markRead and markReadBatch", () => {
    const state = { revealedIds: [] as number[], snapshots: [] as [number, RevealSnapshot][] };
    applyQueueEntry(state, { action: "markRead", gameId: 9, queuedAt: "t" });
    expect(state.revealedIds).toContain(9);
    applyQueueEntry(state, { action: "markReadBatch", gameIds: [1, 2, 9], queuedAt: "t" });
    expect(new Set(state.revealedIds).size).toBe(3);
  });

  it("handles revealBatch", () => {
    const state = { revealedIds: [1] as number[], snapshots: [[1, snap("2026-01-01")]] as [number, RevealSnapshot][] };
    applyQueueEntry(state, {
      action: "revealBatch",
      entries: [{ gameId: 2, snapshot: snap("2026-01-03") }],
      queuedAt: "t",
    });
    expect(state.revealedIds).toContain(2);
  });

  it("handles hide and hideBatch", () => {
    const state = {
      revealedIds: [1, 2, 3],
      snapshots: [[1, snap("t")]] as [number, RevealSnapshot][],
    };
    applyQueueEntry(state, { action: "hide", gameId: 2, queuedAt: "t" });
    expect(state.revealedIds).not.toContain(2);
    applyQueueEntry(state, { action: "hideBatch", gameIds: [1, 3], queuedAt: "t" });
    expect(state.revealedIds.length).toBe(0);
  });
});

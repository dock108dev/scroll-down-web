import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { verifySession } from "@/lib/magic-link";
import { allowDevTierUrlOverrides, STORAGE_KEYS, STORAGE } from "@/lib/config";
import type { RevealSnapshot } from "@/stores/reveal";

// ─── Session helper ───────────────────────────────────────────────────────────

interface ProSession {
  userId: string;
  email: string;
}

function getProSession(req: NextRequest): ProSession | null {
  // Match `allowDevTierUrlOverrides`: Playwright uses `npm start` (production NODE_ENV)
  // with `NEXT_PUBLIC_SCROLLDOWN_E2E=1` so `?tier=pro&userId=` still works in CI.
  if (allowDevTierUrlOverrides()) {
    const param = req.nextUrl.searchParams.get("tier");
    if (param === "free") return null;
    if (param === "pro") {
      const devUserId = req.nextUrl.searchParams.get("userId") ?? "dev-user";
      return { userId: devUserId, email: "dev@test.example" };
    }
  }

  const sessionCookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (!sessionCookie) return null;
  const payload = verifySession(sessionCookie);
  if (!payload || payload.tier !== "pro") return null;
  return { userId: payload.userId, email: payload.email };
}

// ─── File-based KV ────────────────────────────────────────────────────────────

interface RevealRecord {
  revealedIds: number[];
  snapshots: [number, RevealSnapshot][];
  updatedAt: string;
}

type SyncStore = Record<string, RevealRecord>;

function syncPath(): string {
  const dir = process.env.DATA_DIR ?? "/tmp";
  if (dir === "/tmp" && process.env.NODE_ENV === "production") {
    console.warn("[sync/reveal] DATA_DIR is /tmp — reveal sync data will not survive a reboot. Set DATA_DIR to a persistent volume.");
  }
  return join(dir, "sd-reveal-sync.json");
}

function loadStore(): SyncStore {
  try {
    const p = syncPath();
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, "utf8")) as SyncStore;
  } catch (err) {
    console.error("[sync/reveal] loadStore failed — returning empty store. Reveal sync file may be corrupted:", err);
    return {};
  }
}

function saveStore(store: SyncStore): void {
  const dir = process.env.DATA_DIR ?? "/tmp";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(syncPath(), JSON.stringify(store), "utf8");
}

function loadRecord(userId: string): RevealRecord {
  return (
    loadStore()[userId] ?? {
      revealedIds: [],
      snapshots: [],
      updatedAt: new Date(0).toISOString(),
    }
  );
}

function saveRecord(userId: string, record: RevealRecord): void {
  const store = loadStore();
  store[userId] = record;
  saveStore(store);
}

// ─── Merge (union IDs, newest snapshot wins) ─────────────────────────────────

interface SyncBody {
  revealedIds: number[];
  snapshots: Record<string, RevealSnapshot>;
}

function mergeRecord(existing: RevealRecord, incoming: SyncBody): RevealRecord {
  const merged = new Set<number>(existing.revealedIds);
  for (const id of incoming.revealedIds) merged.add(id);

  // Cap at configured max
  const cappedIds = [...merged].slice(-STORAGE.MAX_REVEALED_IDS);

  const snapsMap = new Map<number, RevealSnapshot>(existing.snapshots);
  for (const [idStr, snap] of Object.entries(incoming.snapshots)) {
    const id = Number(idStr);
    const cur = snapsMap.get(id);
    if (!cur || snap.snapshotAt > cur.snapshotAt) {
      snapsMap.set(id, snap);
    }
  }

  // Cap snapshots at configured max (keep newest)
  const snapsEntries = [...snapsMap].sort(([, a], [, b]) =>
    b.snapshotAt.localeCompare(a.snapshotAt),
  ).slice(0, STORAGE.MAX_SNAPSHOTS);

  return {
    revealedIds: cappedIds,
    snapshots: snapsEntries,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = getProSession(req);
  if (!session) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const record = loadRecord(session.userId);
  return NextResponse.json({
    revealedIds: record.revealedIds,
    snapshots: Object.fromEntries(record.snapshots),
    updatedAt: record.updatedAt,
  });
}

export async function PUT(req: NextRequest) {
  const session = getProSession(req);
  if (!session) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!Array.isArray(body.revealedIds) || typeof body.snapshots !== "object" || body.snapshots === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const existing = loadRecord(session.userId);
  const merged = mergeRecord(existing, body);
  saveRecord(session.userId, merged);

  return NextResponse.json({
    revealedIds: merged.revealedIds,
    snapshots: Object.fromEntries(merged.snapshots),
    updatedAt: merged.updatedAt,
  });
}

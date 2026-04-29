import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
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
  const p = syncPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SyncStore;
  } catch (err) {
    // Corrupt sync file is a data-loss risk: returning {} would let the next
    // saveStore() call overwrite the original, wiping every Pro user's reveal
    // history. Quarantine first so manual recovery is possible.
    // See docs/audits/error-handling-report.md §F2.
    const quarantine = `${p}.corrupt-${Date.now()}`;
    try {
      renameSync(p, quarantine);
      console.error(`[sync/reveal] loadStore failed — sync file quarantined to ${quarantine}. Manual recovery required:`, err);
    } catch (renameErr) {
      console.error("[sync/reveal] loadStore failed AND quarantine rename failed — refusing to return empty store; throwing to prevent data loss:", err, renameErr);
      throw err;
    }
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

// Hard cap on PUT bodies. The merged record is bounded by STORAGE.MAX_REVEALED_IDS
// (500 ints) and STORAGE.MAX_SNAPSHOTS (20 small objects), so a legitimate
// payload is on the order of a few KB. 64KB leaves headroom for unusual
// snapshot strings while preventing a Pro user from spending unbounded server
// memory parsing a multi-MB body before we trim.
// See docs/audits/security-report.md §H4.
const MAX_SYNC_BODY_BYTES = 64 * 1024;

function isFiniteInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v);
}

/**
 * Server-side we only depend on `snapshotAt` (used by mergeRecord to pick the
 * newest snapshot). The rest of the fields are passed through to the next GET
 * for the same userId and never interpreted, so we keep validation surface
 * small — reject obvious garbage but don't enforce the full client shape.
 */
function isValidSnapshot(v: unknown): v is RevealSnapshot {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  if (typeof s.snapshotAt !== "string" || s.snapshotAt.length === 0 || s.snapshotAt.length > 64) {
    return false;
  }
  return true;
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

  // Reject oversized bodies before parsing (best-effort: a forged
  // Content-Length is caught by the post-parse byte check below).
  // See docs/audits/security-report.md §H4.
  const declaredLen = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLen) && declaredLen > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }

  let body: SyncBody;
  try {
    body = JSON.parse(rawBody) as SyncBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!Array.isArray(body.revealedIds) || typeof body.snapshots !== "object" || body.snapshots === null || Array.isArray(body.snapshots)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Drop any non-integer entries rather than 400ing — clients on older
  // versions may have a sparse local set that includes legacy strings, and
  // we'd rather sync the integer subset than refuse the request entirely.
  // The downstream cap (STORAGE.MAX_REVEALED_IDS) bounds the result.
  body.revealedIds = body.revealedIds.filter(isFiniteInt);

  // Validate snapshot map: drop entries whose key isn't a finite int, or
  // whose value fails minimal shape checks. Same rationale as above.
  const validatedSnaps: Record<string, RevealSnapshot> = {};
  for (const [key, snap] of Object.entries(body.snapshots)) {
    const id = Number(key);
    if (!Number.isFinite(id) || !Number.isInteger(id)) continue;
    if (!isValidSnapshot(snap)) continue;
    validatedSnaps[key] = snap;
  }
  body.snapshots = validatedSnaps;

  const existing = loadRecord(session.userId);
  const merged = mergeRecord(existing, body);
  saveRecord(session.userId, merged);

  return NextResponse.json({
    revealedIds: merged.revealedIds,
    snapshots: Object.fromEntries(merged.snapshots),
    updatedAt: merged.updatedAt,
  });
}

import { NextResponse } from "next/server";
import type { GolfLeaderboardEntry } from "@/lib/types";

const API_BASE = "https://v1.golf.api-sports.io";
const TTL_MS = 60_000;
const SWR_MS = 120_000;

interface CacheEntry {
  data: GolfLeaderboardEntry[];
  fetchedAt: number;
}

let _cache: CacheEntry | null = null;
let _inflight: Promise<GolfLeaderboardEntry[]> | null = null;

interface ApiSportsScore {
  holes_played: number | null;
  actual: number | null;
  today: number | null;
}

interface ApiSportsPlayer {
  player: { id: number; name: string };
  position: number | string;
  score: ApiSportsScore | null;
  status: string | null;
}

interface ApiSportsTournament {
  id: number;
  status: string;
}

function normalizeEntry(raw: ApiSportsPlayer): GolfLeaderboardEntry {
  return {
    playerId: String(raw.player.id),
    name: raw.player.name,
    position: String(raw.position),
    totalScore: typeof raw.score?.actual === "number" ? raw.score.actual : 0,
    todayScore: typeof raw.score?.today === "number" ? raw.score.today : 0,
    thru:
      raw.score?.holes_played != null
        ? String(raw.score.holes_played)
        : "F",
    status: raw.status ?? "active",
  };
}

async function findActiveTournamentId(apiKey: string): Promise<number | null> {
  const year = new Date().getFullYear();
  const res = await fetch(
    `${API_BASE}/tournaments?season=${year}&tour=PGA`,
    {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 300 },
    },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const active = (body.response as ApiSportsTournament[]).find(
    (t) => t.status === "in_progress",
  );
  return active?.id ?? null;
}

async function fetchCurrentLeaderboard(): Promise<GolfLeaderboardEntry[]> {
  const apiKey = process.env.GOLF_API_KEY;
  if (!apiKey) throw new Error("GOLF_API_KEY is not configured");

  const envId = process.env.GOLF_TOURNAMENT_ID;
  const tournamentId = envId
    ? parseInt(envId, 10)
    : await findActiveTournamentId(apiKey);

  if (!tournamentId) {
    console.info("[golf/leaderboard] no active tournament found; returning empty leaderboard");
    return [];
  }

  const year = new Date().getFullYear();
  const res = await fetch(
    `${API_BASE}/leaderboard?tournament=${tournamentId}&season=${year}`,
    {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`API-Sports returned ${res.status}`);

  const body = await res.json();
  return (body.response as ApiSportsPlayer[]).map(normalizeEntry);
}

async function refresh(): Promise<GolfLeaderboardEntry[]> {
  try {
    const data = await fetchCurrentLeaderboard();
    _cache = { data, fetchedAt: Date.now() };
    return data;
  } finally {
    _inflight = null;
  }
}

export async function GET(): Promise<NextResponse> {
  if (process.env.GOLF_ENABLED !== "true") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const now = Date.now();

  if (_cache && now - _cache.fetchedAt < TTL_MS) {
    return NextResponse.json(_cache.data);
  }

  if (_cache && now - _cache.fetchedAt < SWR_MS) {
    if (!_inflight) {
      _inflight = refresh();
    }
    return NextResponse.json(_cache.data);
  }

  if (!_inflight) {
    _inflight = refresh();
  }

  try {
    const data = await _inflight;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch golf leaderboard" },
      { status: 502 },
    );
  }
}

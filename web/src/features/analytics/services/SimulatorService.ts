import type {
  SimulatorTeam,
  SimulatorResult,
  MLBRosterResponse,
  SimulationRequest,
} from "../types";
import { useAuth } from "@/stores/auth";

// ─── Helpers ────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

// ─── Teams ──────────────────────────────────────────────────

let teamsCache: SimulatorTeam[] | null = null;

export async function fetchTeams(): Promise<SimulatorTeam[]> {
  if (teamsCache) return teamsCache;
  const data = await fetchJson<{ teams: SimulatorTeam[]; count: number }>(
    "/api/analytics/mlb-teams",
  );
  teamsCache = data.teams;
  return teamsCache;
}

// ─── Rosters ────────────────────────────────────────────────

const rosterCache = new Map<string, MLBRosterResponse>();

export async function fetchRoster(
  teamAbbr: string,
): Promise<MLBRosterResponse> {
  const cached = rosterCache.get(teamAbbr);
  if (cached) return cached;
  const data = await fetchJson<MLBRosterResponse>(
    `/api/analytics/mlb-roster?team=${encodeURIComponent(teamAbbr)}`,
  );
  rosterCache.set(teamAbbr, data);
  return data;
}

// ─── Simulation ─────────────────────────────────────────────

export async function runSimulation(
  request: SimulationRequest,
): Promise<SimulatorResult> {
  return fetchJson<SimulatorResult>("/api/analytics/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

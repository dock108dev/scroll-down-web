import type {
  SimulatorTeam,
  SimulatorResult,
  MLBRosterResponse,
  SimulationRequest,
} from "../types";
import { fetchApi } from "@/lib/api";

// ─── Teams ──────────────────────────────────────────────────

let teamsCache: SimulatorTeam[] | null = null;

export async function fetchTeams(): Promise<SimulatorTeam[]> {
  if (teamsCache) return teamsCache;
  const data = await fetchApi<{ teams: SimulatorTeam[]; count: number }>(
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
  const data = await fetchApi<MLBRosterResponse>(
    `/api/analytics/mlb-roster?team=${encodeURIComponent(teamAbbr)}`,
  );
  rosterCache.set(teamAbbr, data);
  return data;
}

// ─── Simulation ─────────────────────────────────────────────

export async function runSimulation(
  request: SimulationRequest,
): Promise<SimulatorResult> {
  return fetchApi<SimulatorResult>("/api/analytics/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

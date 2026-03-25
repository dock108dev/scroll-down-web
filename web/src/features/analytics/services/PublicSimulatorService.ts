import type {
  SimulatorTeam,
  SimulatorResult,
  PublicSimulationRequest,
} from "../types";
import { dedupeTeams } from "./SimulatorService";
import { fetchApi } from "@/lib/api";

// ─── Teams (cached per sport) ────────────────────────────────

const teamsCache = new Map<string, SimulatorTeam[]>();

export async function fetchSimulatorTeams(
  sport: string,
): Promise<SimulatorTeam[]> {
  const cached = teamsCache.get(sport);
  if (cached) return cached;
  const data = await fetchApi<{ teams: SimulatorTeam[]; count: number }>(
    `/api/simulator/${sport}/teams`,
  );
  const teams = dedupeTeams(data.teams);
  teamsCache.set(sport, teams);
  return teams;
}

// ─── Simulation ──────────────────────────────────────────────

export async function runPublicSimulation(
  sport: string,
  request: PublicSimulationRequest,
): Promise<SimulatorResult> {
  return fetchApi<SimulatorResult>(`/api/simulator/${sport}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

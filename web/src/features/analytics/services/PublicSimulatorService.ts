import type {
  SimulatorTeam,
  SimulatorResult,
  PublicSimulationRequest,
} from "../types";
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
  // SDA upstream now scopes the response to the requested sport — no more
  // cross-sport leak under shared abbreviations (was: "ARI" returning NFL
  // Cardinals + NHL Coyotes + MLB Diamondbacks).
  teamsCache.set(sport, data.teams);
  return data.teams;
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
    // Default fetchApi timeout is 3s; Monte Carlo with 10k iterations
    // typically returns in 2-5s now that the upstream wraps the simulator
    // in asyncio.to_thread (no longer serialized on the ASGI worker).
    timeoutMs: 10_000,
  });
}

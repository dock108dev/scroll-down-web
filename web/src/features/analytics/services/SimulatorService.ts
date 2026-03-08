import type { SimulatorTeam, SimulatorResult } from "../types";

let teamsCache: SimulatorTeam[] | null = null;
const simCache = new Map<string, SimulatorResult>();

export async function fetchTeams(): Promise<SimulatorTeam[]> {
  if (teamsCache) return teamsCache;

  const res = await fetch("/api/simulator/mlb/teams");
  if (!res.ok) throw new Error(`Failed to fetch teams: ${res.status}`);

  const data = await res.json();
  teamsCache = data.teams as SimulatorTeam[];
  return teamsCache;
}

export async function runSimulation(
  homeTeam: string,
  awayTeam: string,
  iterations = 5000,
): Promise<SimulatorResult> {
  const key = `${homeTeam}-${awayTeam}-${iterations}`;
  const cached = simCache.get(key);
  if (cached) return cached;

  const res = await fetch("/api/simulator/mlb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      home_team: homeTeam,
      away_team: awayTeam,
      iterations,
    }),
  });

  if (!res.ok) throw new Error(`Simulation failed: ${res.status}`);

  const data: SimulatorResult = await res.json();
  simCache.set(key, data);
  return data;
}

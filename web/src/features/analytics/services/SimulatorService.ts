import type { SimulatorTeam, SimulatorResult } from "../types";
import { api } from "@/lib/api";

let teamsCache: SimulatorTeam[] | null = null;
const simCache = new Map<string, SimulatorResult>();

export async function fetchTeams(): Promise<SimulatorTeam[]> {
  if (teamsCache) return teamsCache;

  const data = await api.simulatorTeams();
  // Filter to real MLB teams (100+ games with advanced stats)
  teamsCache = data.teams.filter((t) => t.games_with_stats >= 100);
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

  const data = await api.simulate(homeTeam, awayTeam, iterations);
  simCache.set(key, data);
  return data;
}

import type { SimulationResult } from "../types";

const cache = new Map<number, SimulationResult>();

export async function runGameSimulation(
  gameId: number,
  sport: string,
  homeTeam: string,
  awayTeam: string,
): Promise<SimulationResult> {
  const cached = cache.get(gameId);
  if (cached) return cached;

  const res = await fetch("/api/analytics/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sport: sport.toLowerCase(),
      home_team: homeTeam,
      away_team: awayTeam,
      iterations: 5000,
      probability_mode: "ensemble",
    }),
  });

  if (!res.ok) {
    throw new Error(`Simulation failed: ${res.status}`);
  }

  const data: SimulationResult = await res.json();
  cache.set(gameId, data);
  return data;
}

export function getCachedSimulation(
  gameId: number,
): SimulationResult | undefined {
  return cache.get(gameId);
}

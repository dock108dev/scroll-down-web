import type { TeamProfile, DataCoverage } from "../types";
import { fetchApi } from "@/lib/api";

export async function fetchTeamProfile(
  teamAbbr: string,
  windowDays: number,
): Promise<TeamProfile> {
  return fetchApi<TeamProfile>(
    `/api/analytics/team-profile?team=${encodeURIComponent(teamAbbr)}&window=${windowDays}`,
  );
}

export async function fetchDataCoverage(): Promise<DataCoverage> {
  return fetchApi<DataCoverage>("/api/analytics/mlb-data-coverage");
}

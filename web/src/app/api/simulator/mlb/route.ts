import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

interface TeamsResponse {
  teams: { abbreviation: string; name: string }[];
}

// Cache team name lookup to avoid repeated fetches
let teamMap: Map<string, string> | null = null;

async function getTeamMap(): Promise<Map<string, string>> {
  if (teamMap) return teamMap;
  const data = await apiFetch<TeamsResponse>("/api/simulator/mlb/teams");
  teamMap = new Map(data.teams.map((t) => [t.abbreviation, t.name]));
  return teamMap;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { home_team, away_team, iterations = 5000 } = body;

    // Resolve abbreviations to full team names
    const map = await getTeamMap();
    const homeName = map.get(home_team) ?? home_team;
    const awayName = map.get(away_team) ?? away_team;

    const data = await apiFetch("/api/analytics/simulate", {
      method: "POST",
      body: JSON.stringify({
        sport: "mlb",
        home_team: homeName,
        away_team: awayName,
        iterations,
        probability_mode: "ensemble",
      }),
      revalidate: 0,
    });

    // Normalize response to match SimulatorResult shape
    const resp = data as Record<string, unknown>;
    const profileMeta = resp.profile_meta as Record<string, boolean> | undefined;

    return NextResponse.json({
      home_team: home_team,
      away_team: away_team,
      home_win_probability: resp.home_win_probability,
      away_win_probability: resp.away_win_probability,
      average_home_score: resp.average_home_score,
      average_away_score: resp.average_away_score,
      average_total: resp.average_total,
      median_total: resp.median_total,
      most_common_scores: resp.most_common_scores,
      iterations: resp.iterations,
      rolling_window: resp.rolling_window ?? 30,
      profiles_loaded: profileMeta?.has_profiles ?? false,
      home_pa_probabilities: resp.home_pa_probabilities ?? null,
      away_pa_probabilities: resp.away_pa_probabilities ?? null,
      model_home_win_probability: resp.model_home_win_probability ?? null,
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status },
    );
  }
}

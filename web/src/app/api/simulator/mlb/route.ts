import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { SimulatorResult } from "@/features/analytics/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { home_team, away_team, iterations = 5000 } = body;

    // Use the downstream simulator endpoint — its response shape
    // matches SimulatorResult directly (profiles_loaded, rolling_window,
    // model_home_win_probability all at top level). The admin
    // /api/analytics/simulate endpoint nests these under profile_meta.
    const data = await apiFetch<SimulatorResult>("/api/simulator/mlb", {
      method: "POST",
      body: JSON.stringify({ home_team, away_team, iterations }),
      revalidate: 0,
    });

    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status },
    );
  }
}

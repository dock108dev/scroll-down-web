import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, deepSnakeKeys, forwardAuth } from "@/lib/api-server";

const VALID_SPORTS = new Set(["mlb", "nba", "nhl", "ncaab"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sport: string }> },
) {
  const { sport } = await params;
  if (!VALID_SPORTS.has(sport)) {
    return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const data = await apiFetch(`/api/simulator/${sport}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: forwardAuth(req),
      revalidate: 0,
      // Monte Carlo simulations on the upstream commonly take 2-5s; the
      // default 5s sometimes clips. Give a generous ceiling.
      timeoutMs: 30_000,
    });
    // Upstream returns camelCase; SimulatorResult/MonteCarloSheet read
    // snake_case (home_win_probability, average_home_score, etc.). Normalize
    // at the proxy edge so consumers don't crash on undefined fields.
    return NextResponse.json(deepSnakeKeys(data));
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status },
    );
  }
}

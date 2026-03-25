import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

const VALID_SPORTS = new Set(["mlb", "nba", "nhl", "ncaab"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sport: string }> },
) {
  const { sport } = await params;
  if (!VALID_SPORTS.has(sport)) {
    return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
  }
  try {
    const data = await apiFetch(`/api/simulator/${sport}/teams`, {
      revalidate: 3600,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

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

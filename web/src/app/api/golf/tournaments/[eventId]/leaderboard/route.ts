import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import type { GolfLeaderboardResponse } from "@/lib/golf-types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  try {
    const data = await apiFetch<GolfLeaderboardResponse>(
      `/api/golf/tournaments/${eventId}/leaderboard`,
      { headers: forwardAuth(req), revalidate: 0 },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status },
    );
  }
}

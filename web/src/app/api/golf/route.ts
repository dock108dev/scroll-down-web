import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "Not found",
      hint: "Use /api/golf/tournaments for tournament listings, or /api/golf/tournaments/[eventId]/leaderboard for leaderboard data.",
    },
    { status: 404 },
  );
}

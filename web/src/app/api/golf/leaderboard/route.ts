import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "Not found",
      hint: "Use /api/golf/tournaments/[eventId]/leaderboard with a valid event ID.",
    },
    { status: 404 },
  );
}

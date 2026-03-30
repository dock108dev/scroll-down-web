import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "Not found",
      hint: "Use /api/fairbet/odds for pre-game odds or /api/fairbet/live for in-game odds.",
    },
    { status: 404 },
  );
}

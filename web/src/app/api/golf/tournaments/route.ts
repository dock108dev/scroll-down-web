import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import type { GolfTournamentListResponse } from "@/lib/golf-types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const path = `/api/golf/tournaments${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch<GolfTournamentListResponse>(path, {
      headers: forwardAuth(req),
      revalidate: 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch tournaments" },
      { status },
    );
  }
}

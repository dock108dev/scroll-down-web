import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get("team");
    if (!team) {
      return NextResponse.json(
        { error: "Missing team parameter" },
        { status: 400 },
      );
    }

    const data = await apiFetch(
      `/api/analytics/mlb-roster?team=${encodeURIComponent(team)}`,
      { headers: forwardAuth(req), revalidate: 3600 },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch roster" },
      { status },
    );
  }
}

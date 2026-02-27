import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { TeamListResponse } from "@/lib/types";

export async function GET() {
  try {
    const data = await apiFetch<TeamListResponse>("/api/admin/sports/teams", {
      revalidate: 3600,
    });
    return NextResponse.json(data.teams);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to fetch teams" }, { status });
  }
}

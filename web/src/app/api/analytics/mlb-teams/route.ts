import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

export async function GET() {
  try {
    const data = await apiFetch("/api/analytics/mlb-teams", {
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

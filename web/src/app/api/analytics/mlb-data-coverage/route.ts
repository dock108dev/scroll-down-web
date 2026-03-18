import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    const data = await apiFetch("/api/analytics/mlb-data-coverage", {
      headers: forwardAuth(req),
      revalidate: 3600,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch data coverage" },
      { status },
    );
  }
}

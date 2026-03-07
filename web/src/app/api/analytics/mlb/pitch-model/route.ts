import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const path = `/api/analytics/mlb/pitch-model${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch(path, { revalidate: 0 });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch pitch model" },
      { status },
    );
  }
}

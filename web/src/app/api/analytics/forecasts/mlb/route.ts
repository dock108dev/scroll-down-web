import { type NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const path = `/api/analytics/forecasts/mlb${qs ? `?${qs}` : ""}`;
    const data = await apiFetch(path, { revalidate: 300, timeoutMs: 10_000 });
    return NextResponse.json(data);
  } catch (err) {
    const status =
      err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json(
      { error: "Failed to fetch forecasts" },
      { status },
    );
  }
}

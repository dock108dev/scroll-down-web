import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, deepSnakeKeys, forwardAuth } from "@/lib/api-server";
import type { BetsResponse } from "@/lib/types";


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const path = `/api/fairbet/odds${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch<BetsResponse>(path, {
      revalidate: 0,
      headers: forwardAuth(req),
    });
    // Upstream returns camelCase; client expects snake_case.
    return NextResponse.json(deepSnakeKeys(data));
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json(
      { error: "Failed to fetch FairBet odds" },
      { status },
    );
  }
}

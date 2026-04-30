import { NextRequest, NextResponse } from "next/server";
import { cachedApiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import type { GameListResponse } from "@/lib/types";
import { API } from "@/lib/config";


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const path = `/api/admin/sports/games${qs ? `?${qs}` : ""}`;
  const cacheKey = `games:${qs}`;

  try {
    const { data, cacheStatus } = await cachedApiFetch<GameListResponse>(cacheKey, path, {
      headers: forwardAuth(req),
      revalidate: 0,
      freshMs: API.GAMES_BFF_FRESH_MS,
      staleMs: API.GAMES_BFF_STALE_MS,
    });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-if-error=300",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch games" }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cachedApiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import type { GameDetailResponse } from "@/lib/types";
import { API } from "@/lib/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { data, cacheStatus } = await cachedApiFetch<GameDetailResponse>(
      `game:${id}`,
      `/api/admin/sports/games/${id}`,
      {
        headers: forwardAuth(req),
        revalidate: 0,
        freshMs: API.GAME_DETAIL_BFF_FRESH_MS,
        staleMs: API.GAME_DETAIL_BFF_STALE_MS,
      },
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-if-error=180",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch game" }, { status });
  }
}

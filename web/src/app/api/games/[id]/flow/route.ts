import { NextRequest, NextResponse } from "next/server";
import { cachedApiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import type { GameFlowResponse } from "@/lib/types";
import { API } from "@/lib/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { data, cacheStatus } = await cachedApiFetch<GameFlowResponse>(
      `game-flow:${id}`,
      `/api/admin/sports/games/${id}/flow`,
      {
        headers: forwardAuth(req),
        revalidate: 0,
        freshMs: API.GAME_FLOW_BFF_FRESH_MS,
        staleMs: API.GAME_FLOW_BFF_STALE_MS,
      },
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-if-error=300",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json(
      { error: "Failed to fetch game flow" },
      { status },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";
import type { SdmDeckResponse } from "@/types/scroll-down-mlb";

/**
 * BFF proxy: forwards the request to SDA's
 * `GET /api/v1/scroll-down-mlb/games/{gameId}/deck` endpoint and returns
 * the response unchanged. The Phase 4 swap moved deck-generation into
 * SDA; this route is now just an API-key boundary so the browser never
 * holds the upstream key.
 *
 * 404 from SDA → 404 to client (no deck yet).
 * 5xx / gateway → translated by ApiError to a 502 for the client.
 *
 * Cache-Control mirrors the previous behavior: short TTL while live,
 * long TTL once the deck is final/immutable.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId: gameIdStr } = await params;
  if (!gameIdStr || !/^[A-Za-z0-9_-]+$/.test(gameIdStr)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const cacheKey = `sdm-deck:${gameIdStr}`;
  const path = `/api/v1/scroll-down-mlb/games/${encodeURIComponent(gameIdStr)}/deck`;

  try {
    const { data, cacheStatus } = await cachedApiFetch<SdmDeckResponse>(
      cacheKey,
      path,
      {
        revalidate: 0,
        freshMs: API.CARDS_LIVE_BFF_FRESH_MS,
        staleMs: API.CARDS_LIVE_BFF_STALE_MS,
      },
    );

    const cacheControl = data.isFinal
      ? "private, max-age=86400, stale-if-error=604800, immutable"
      : "private, max-age=10, stale-if-error=180";

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": cacheControl,
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: "No deck for this game yet." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch deck" }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";
import type { SdmRevealResponse } from "@/types/scroll-down-mlb";

/**
 * BFF proxy: forwards the request to SDA's
 * `GET /api/v1/scroll-down-mlb/games/{gameId}/reveal` endpoint.
 *
 * SDA's 409 ("reveal not available yet") propagates as 409 to the client
 * so the FinalReveal can show "we couldn't get the result yet" without
 * asserting an error state.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId: gameIdStr } = await params;
  // 64 chars is far more than any real MLB gamePk; keep it bounded so a
  // crafted long-id request can't poison the in-memory cache key map.
  if (!gameIdStr || gameIdStr.length > 64 || !/^[A-Za-z0-9_-]+$/.test(gameIdStr)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const cacheKey = `sdm-reveal:${gameIdStr}`;
  const path = `/api/v1/scroll-down-mlb/games/${encodeURIComponent(gameIdStr)}/reveal`;

  try {
    const { data, cacheStatus } = await cachedApiFetch<SdmRevealResponse>(
      cacheKey,
      path,
      {
        revalidate: 0,
        freshMs: API.CARDS_FINAL_BFF_FRESH_MS,
        staleMs: API.CARDS_FINAL_BFF_STALE_MS,
      },
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=86400, stale-if-error=604800, immutable",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return NextResponse.json(
        { error: "Reveal not available yet for this game." },
        { status: 409 },
      );
    }
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: "Failed to fetch reveal" }, { status: err.proxyStatus });
    }
    // Non-ApiError reaching here is a code bug, not an upstream issue. Log
    // so prod incidents are diagnosable instead of presenting as anonymous
    // 500s. See docs/audits/error-handling-report.md §I1.
    console.error("[api/games/summary] unexpected error", err);
    return NextResponse.json({ error: "Failed to fetch reveal" }, { status: 500 });
  }
}

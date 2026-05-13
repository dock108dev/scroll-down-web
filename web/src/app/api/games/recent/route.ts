import { NextRequest, NextResponse } from "next/server";
import { ApiError, cachedApiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";
import type { SdmRecentResponse } from "@/types/scroll-down-mlb";

/**
 * BFF proxy: forwards the request to SDA's
 * `GET /api/v1/scroll-down-mlb/games/recent` endpoint.
 *
 * The SDA endpoint is spoiler-safe by construction (no scores, no
 * winners). This proxy adds no transformation; the wire shape is the
 * frontend's source of truth.
 */

export async function GET(_req: NextRequest) {
  const cacheKey = "sdm-recent";
  const path = "/api/v1/scroll-down-mlb/games/recent";

  try {
    const { data, cacheStatus } = await cachedApiFetch<SdmRecentResponse>(
      cacheKey,
      path,
      {
        revalidate: 0,
        freshMs: API.GAMES_BFF_FRESH_MS,
        staleMs: API.GAMES_BFF_STALE_MS,
      },
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-if-error=300",
        "X-SD-Cache": cacheStatus,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: "Failed to fetch games" }, { status: err.proxyStatus });
    }
    // Non-ApiError reaching here is a code bug, not an upstream issue. Log
    // so prod incidents are diagnosable instead of presenting as anonymous
    // 500s. See docs/audits/error-handling-report.md §I1.
    console.error("[api/games/recent] unexpected error", err);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/api-server";

const API_KEY = process.env.SPORTS_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.API_KEY || "";

/**
 * SSE proxy — streams /v1/sse from the backend with the API key injected.
 * Browser EventSource can't set custom headers, so this proxy handles it.
 */
export async function GET(req: NextRequest) {
  const channels = req.nextUrl.searchParams.get("channels") || "";
  const url = `${BASE_URL}/v1/sse?channels=${encodeURIComponent(channels)}`;

  const upstream = await fetch(url, {
    headers: {
      "X-API-Key": API_KEY,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body ?? "SSE upstream error", {
      status: upstream.status,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

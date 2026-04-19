import { NextRequest } from "next/server";
import { sportsApiBaseUrl, sportsApiKey } from "@/lib/api-server";

/**
 * SSE proxy — streams /v1/sse from the backend with the API key injected.
 * Browser EventSource can't set custom headers, so this proxy handles it.
 */
export async function GET(req: NextRequest) {
  const channels = req.nextUrl.searchParams.get("channels") || "";
  const url = `${sportsApiBaseUrl()}/v1/sse?channels=${encodeURIComponent(channels)}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        "X-API-Key": sportsApiKey(),
        Accept: "text/event-stream",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[sse-proxy] upstream fetch failed:", err);
    return new Response("SSE connection failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("SSE connection failed", {
      status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
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

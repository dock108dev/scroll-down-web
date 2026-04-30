import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Playwright's `webServer` sets this so `/api/health` does not block on a WAN
 * upstream for every poll (DegradedBanner hits this often). Production and
 * normal `npm run dev` never set this — only `playwright.config.ts` webServer.
 */
const SKIP_UPSTREAM_HEALTH = process.env.SCROLLDOWN_PLAYWRIGHT_WEB_SERVER === "1";

let cachedHealth: {
  checkedAt: number;
  status: "ok" | "degraded";
} | null = null;

function healthPingLogMessage(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return `upstream ping timed out after ${API.HEALTH_BACKEND_PING_TIMEOUT_MS}ms`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET() {
  if (SKIP_UPSTREAM_HEALTH) {
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }

  if (cachedHealth && Date.now() - cachedHealth.checkedAt < API.HEALTH_CACHE_MS) {
    return NextResponse.json(
      {
        status: cachedHealth.status,
        timestamp: new Date(cachedHealth.checkedAt).toISOString(),
        cached: true,
      },
      { status: cachedHealth.status === "ok" ? 200 : 503 },
    );
  }

  let backendStatus: "ok" | "degraded" = "ok";

  try {
    // Ping backend with a lightweight endpoint; bounded timeout so health never hangs
    await apiFetch("/api/admin/sports/games?limit=1", {
      revalidate: 0,
      timeoutMs: API.HEALTH_BACKEND_PING_TIMEOUT_MS,
    });
  } catch (err) {
    console.error("[health] backend ping failed:", healthPingLogMessage(err));
    backendStatus = "degraded";
  }

  const status = backendStatus === "ok" ? "ok" : "degraded";
  cachedHealth = { checkedAt: Date.now(), status };

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}

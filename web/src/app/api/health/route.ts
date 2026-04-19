import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-server";
import { API } from "@/lib/config";

export const dynamic = "force-dynamic";

function healthPingLogMessage(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return `upstream ping timed out after ${API.HEALTH_BACKEND_PING_TIMEOUT_MS}ms`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET() {
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

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}

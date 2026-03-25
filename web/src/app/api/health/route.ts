import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-server";

export const dynamic = "force-dynamic";

export async function GET() {
  let backendStatus: "ok" | "degraded" = "ok";

  try {
    // Ping backend with a lightweight endpoint; short timeout so health never hangs
    await apiFetch("/api/admin/sports/games?limit=1", { revalidate: 0, timeoutMs: 4_000 });
  } catch {
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

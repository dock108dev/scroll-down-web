import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-server";

export const dynamic = "force-dynamic";

export async function GET() {
  let backendStatus: "ok" | "degraded" = "ok";

  try {
    // Ping backend with a lightweight endpoint
    await apiFetch("/games", { revalidate: 0 });
  } catch {
    backendStatus = "degraded";
  }

  const status = backendStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: status === "ok" ? 200 : 503 },
  );
}

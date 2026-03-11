import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiFetch("/api/analytics/simulate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: forwardAuth(req),
      revalidate: 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status },
    );
  }
}

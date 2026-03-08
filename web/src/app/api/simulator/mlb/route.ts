import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiFetch("/api/simulator/mlb", {
      method: "POST",
      body: JSON.stringify(body),
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

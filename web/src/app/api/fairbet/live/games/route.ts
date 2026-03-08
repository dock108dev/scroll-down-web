import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { LiveGameInfo } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const path = `/api/fairbet/live/games${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch<LiveGameInfo[]>(path, { revalidate: 0 });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch live games" },
      { status },
    );
  }
}

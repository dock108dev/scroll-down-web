import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { GameListResponse } from "@/lib/types";
import { API } from "@/lib/config";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const path = `/api/admin/sports/games${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch<GameListResponse>(path, { revalidate: API.ISR_REVALIDATE_S });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to fetch games" }, { status });
  }
}

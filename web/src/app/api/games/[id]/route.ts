import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { GameDetailResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await apiFetch<GameDetailResponse>(
      `/api/admin/sports/games/${id}`,
      { revalidate: 30 },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to fetch game" }, { status });
  }
}

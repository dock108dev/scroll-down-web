import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";
import type { GameFlowResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await apiFetch<GameFlowResponse>(
      `/api/admin/sports/games/${id}/flow`,
      { revalidate: 60 },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch game flow" },
      { status },
    );
  }
}

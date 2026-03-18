import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await apiFetch(
      `/api/analytics/experiments/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: forwardAuth(req),
        revalidate: 0,
      },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to cancel experiment" },
      { status },
    );
  }
}

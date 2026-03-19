import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const path = `/api/analytics/prediction-outcomes${qs ? `?${qs}` : ""}`;
    const data = await apiFetch(path, {
      headers: forwardAuth(req),
      revalidate: 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch prediction outcomes" },
      { status },
    );
  }
}

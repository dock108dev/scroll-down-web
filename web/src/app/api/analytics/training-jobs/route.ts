import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    const data = await apiFetch("/api/analytics/training-jobs", {
      headers: forwardAuth(req),
      revalidate: 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch training jobs" },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const jobId = url.searchParams.get("job_id");
    const body = await req.json();
    const data = await apiFetch(
      `/api/analytics/training-jobs${action ? `?action=${action}` : ""}${jobId ? `&job_id=${encodeURIComponent(jobId)}` : ""}`,
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
      { error: "Failed to update training job" },
      { status },
    );
  }
}

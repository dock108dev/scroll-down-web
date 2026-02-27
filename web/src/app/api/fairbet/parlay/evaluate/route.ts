import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-server";

interface ParlayEvaluateResponse {
  fair_probability: number;
  fair_american_odds: number;
  confidence: string;
  leg_count: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiFetch<ParlayEvaluateResponse>(
      "/api/fairbet/parlay/evaluate",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Failed to evaluate parlay" },
      { status },
    );
  }
}

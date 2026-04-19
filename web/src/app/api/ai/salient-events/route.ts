import { NextRequest, NextResponse } from "next/server";
import { extractSalientEvents, type BoxScoreInput } from "@/lib/salient-events";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ window: 60_000, max: 30 });

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const limit = limiter.check(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetMs / 1000)) } },
    );
  }

  let body: BoxScoreInput;
  try {
    body = (await req.json()) as BoxScoreInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sport || !body.homeTeam || !body.awayTeam) {
    return NextResponse.json(
      { error: "sport, homeTeam, and awayTeam are required" },
      { status: 400 },
    );
  }

  const result = extractSalientEvents(body);
  return NextResponse.json(result);
}

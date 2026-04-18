import { NextRequest, NextResponse } from "next/server";
import { extractSalientEvents, type BoxScoreInput } from "@/lib/salient-events";
import { verifyStoryNumerics } from "@/lib/story-numeric-verifier";
import { createRateLimiter } from "@/lib/rate-limit";

interface VerifyRequest {
  story: string;
  boxScore: BoxScoreInput;
}

const limiter = createRateLimiter({ window: 60_000, max: 30 });

export async function POST(req: NextRequest): Promise<NextResponse> {
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
  let body: VerifyRequest;
  try {
    body = (await req.json()) as VerifyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.story || typeof body.story !== "string") {
    return NextResponse.json({ error: "story string is required" }, { status: 400 });
  }
  if (!body.boxScore?.sport || !body.boxScore?.homeTeam || !body.boxScore?.awayTeam) {
    return NextResponse.json(
      { error: "boxScore.sport, boxScore.homeTeam, and boxScore.awayTeam are required" },
      { status: 400 },
    );
  }

  const salientResult = extractSalientEvents(body.boxScore);
  const result = verifyStoryNumerics(body.story, body.boxScore, salientResult.events);

  return NextResponse.json(result);
}

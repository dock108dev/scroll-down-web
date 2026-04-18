import { NextRequest, NextResponse } from "next/server";

interface FeedbackBody {
  storyId: string;
  vote: "up" | "down";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.storyId || typeof body.storyId !== "string" || body.storyId.length > 128) {
    return NextResponse.json({ error: "storyId is required and must be ≤128 chars" }, { status: 400 });
  }
  if (body.vote !== "up" && body.vote !== "down") {
    return NextResponse.json(
      { error: "vote must be 'up' or 'down'" },
      { status: 400 },
    );
  }

  console.log(
    JSON.stringify({
      event: "story_feedback",
      storyId: body.storyId,
      vote: body.vote,
      timestamp: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

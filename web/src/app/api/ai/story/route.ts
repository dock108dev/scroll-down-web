import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractSalientEvents, type BoxScoreInput } from "@/lib/salient-events";
import { buildStorySlots, fillTemplate } from "@/lib/story-templates";
import { validateStory } from "@/lib/story-validator";
import { verifyStoryNumerics } from "@/lib/story-numeric-verifier";
import { AI_STORY, STORAGE_KEYS } from "@/lib/config";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/magic-link";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// 10 story generations per minute per IP — generous for real use, stops cost drain
const limiter = createRateLimiter({ window: 60_000, max: 10 });

interface StoryLog {
  event: "story_generated" | "story_rejected";
  sport: string;
  narrativeType: string;
  templateInput: string;
  llmOutput: string;
  valid: boolean;
  rejectionReason: string | null;
  rejectionDetail: string | null;
  sentenceCount: number;
  wordCount: number;
  rejectedNumbers?: number[];
  timestamp: string;
}

function logStory(entry: StoryLog): void {
  console.log(JSON.stringify(entry));
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Require a valid session — prevents anonymous cost-drain of the Anthropic API
  const sessionCookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  const session = sessionCookie ? verifySession(sessionCookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = clientIp(req);
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

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI_UNAVAILABLE", reason: "ANTHROPIC_API_KEY not configured" },
      { status: 503 },
    );
  }

  const salientResult = extractSalientEvents(body);
  const slots = buildStorySlots(body, salientResult);
  const { systemPrompt, userPrompt } = fillTemplate(slots, salientResult.narrativeType);

  let llmText: string;
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: AI_STORY.MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = message.content[0];
    llmText = block.type === "text" ? block.text.trim() : "";
  } catch (err) {
    // Don't echo Anthropic SDK errors back to the caller (key/quota/model state
    // leakage); log the underlying error and return a generic 502.
    // See docs/audits/error-handling-report.md §F8.
    console.error("[ai/story] Anthropic call failed:", err);
    return NextResponse.json(
      { error: "LLM_ERROR" },
      { status: 502 },
    );
  }

  const validation = validateStory(llmText);

  // Run numeric fact-verification only when phrase/length checks pass.
  // A failing whitelist check is logged as numeric_violation and causes
  // the same 422 rejection so callers never receive an unverified story.
  const numeric = validation.valid
    ? verifyStoryNumerics(llmText, body, salientResult.events)
    : null;

  const isValid = validation.valid && (numeric?.valid ?? false);

  const logEntry: StoryLog = {
    event: isValid ? "story_generated" : "story_rejected",
    sport: body.sport,
    narrativeType: salientResult.narrativeType,
    templateInput: userPrompt,
    llmOutput: llmText,
    valid: isValid,
    rejectionReason: validation.valid
      ? (numeric?.valid === false ? "numeric_violation" : null)
      : validation.reason,
    rejectionDetail: validation.valid
      ? (numeric?.valid === false
          ? `Unverifiable numbers: ${numeric.rejectedNumbers.join(", ")}`
          : null)
      : validation.detail,
    sentenceCount: validation.sentenceCount,
    wordCount: validation.wordCount,
    rejectedNumbers: numeric?.rejectedNumbers,
    timestamp: new Date().toISOString(),
  };
  logStory(logEntry);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "STORY_REJECTED",
        reason: validation.reason,
        detail: validation.detail,
      },
      { status: 422 },
    );
  }

  if (numeric && !numeric.valid) {
    return NextResponse.json(
      {
        error: "STORY_REJECTED",
        reason: "numeric_violation",
        detail: `Unverifiable numbers: ${numeric.rejectedNumbers.join(", ")}`,
        rejectedNumbers: numeric.rejectedNumbers,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    story: llmText,
    narrativeType: salientResult.narrativeType,
    events: salientResult.events,
    wordCount: validation.wordCount,
    sentenceCount: validation.sentenceCount,
  });
}

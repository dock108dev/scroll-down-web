import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { isValidEmailFormat, AUTH, allowDevTierUrlOverrides, isPlaywrightServerEnv } from "@/lib/config";
import {
  generateMagicToken,
  storeMagicToken,
  sendMagicLinkEmail,
} from "@/lib/magic-link";

const limiter = createRateLimiter({
  window: AUTH.SEND_LINK_RATE_WINDOW_MS,
  max: AUTH.SEND_LINK_RATE_MAX,
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function baseUrl(req: NextRequest): string {
  const configured = process.env.MAGIC_LINK_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Parallel Playwright workers share one runner IP; skip the tight prod limiter in E2E only.
  if (!isPlaywrightServerEnv() && process.env.NEXT_PUBLIC_SCROLLDOWN_E2E !== "1") {
    const limit = limiter.check(ip);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(limit.resetMs / 1000)) },
        },
      );
    }
  }

  let email: string;
  try {
    const body = await req.json() as { email?: unknown };
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    // Return 200 — never reveal whether email/body parsing failed
    return NextResponse.json({ ok: true });
  }

  // Always return 200 even for invalid email — no user enumeration
  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ ok: true });
  }

  const anonId = req.cookies.get("sd-anon-id")?.value ?? null;
  const token = generateMagicToken();
  storeMagicToken(token, email, anonId);

  const link = `${baseUrl(req)}/api/auth/verify?token=${token}`;

  try {
    await sendMagicLinkEmail(email, link);
  } catch (err) {
    console.error("[send-link] email delivery failed:", err);
    // Do not surface errors — still return 200
  }

  const responseBody: Record<string, unknown> = { ok: true };

  // Expose token in dev and Playwright CI (`npm start` is production NODE_ENV).
  if (allowDevTierUrlOverrides()) {
    responseBody.devToken = token;
  }

  return NextResponse.json(responseBody);
}

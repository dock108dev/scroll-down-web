import { NextRequest, NextResponse } from "next/server";
import { sportsApiBaseUrl } from "@/lib/api-server";
import { createRateLimiter } from "@/lib/rate-limit";

// ── Path whitelist ──────────────────────────────────────────────────────
// Only these backend paths are reachable through the proxy.
// Anything else returns 404 before hitting the backend.

const ALLOWED_PATHS = new Set([
  "login",
  "signup",
  "me",
  "me/email",
  "me/password",
  "me/preferences",
  "refresh",
  "forgot-password",
  "reset-password",
  "magic-link",
  "magic-link/verify",
]);

// ── Rate limiters ───────────────────────────────────────────────────────
// Strict: unauthenticated endpoints vulnerable to brute force / spam
// Standard: authenticated endpoints (higher ceiling, still bounded)

const strictLimiter = createRateLimiter({ window: 60_000, max: 8 });
const standardLimiter = createRateLimiter({ window: 60_000, max: 30 });

const STRICT_PATHS = new Set([
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "magic-link",
  "magic-link/verify",
]);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    // No forwarding headers (local dev or misconfigured proxy). Use UA as a
    // rough discriminator so all headerless requests don't share one bucket.
    `no-ip:${req.headers.get("user-agent")?.slice(0, 64) ?? "unknown"}`
  );
}

function rateLimitResponse(resetMs: number) {
  return NextResponse.json(
    { detail: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(resetMs / 1000)),
      },
    },
  );
}

// ── Proxy handler ───────────────────────────────────────────────────────

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const resolvedPath = path.join("/");

  // ── Whitelist check ──────────────────────────────────────────
  if (!ALLOWED_PATHS.has(resolvedPath)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  // ── Rate limit check ─────────────────────────────────────────
  const ip = getClientIp(req);
  const limiter = STRICT_PATHS.has(resolvedPath) ? strictLimiter : standardLimiter;
  const limit = limiter.check(`${ip}:${resolvedPath}`);

  if (!limit.ok) {
    return rateLimitResponse(limit.resetMs);
  }

  // ── Forward to backend ───────────────────────────────────────
  const url = `${sportsApiBaseUrl()}/auth/${resolvedPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.text();

    if (res.status >= 500) {
      return NextResponse.json(
        { detail: "Auth service error" },
        { status: 502 },
      );
    }

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Auth service unavailable" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

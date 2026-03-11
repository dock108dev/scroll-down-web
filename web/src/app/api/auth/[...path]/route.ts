import { NextRequest, NextResponse } from "next/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://sports-data-admin.dock108.ai";

/**
 * Auth proxy — forwards requests to /auth/* on the backend.
 * Auth endpoints do NOT need X-API-Key; they are public.
 * The Bearer token is forwarded if present (for /auth/me, etc.).
 */
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const backendPath = `/auth/${path.join("/")}`;
  const url = `${BASE_URL}${backendPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward Bearer token if present
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for POST/PATCH/DELETE
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
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
export const PATCH = proxy;
export const DELETE = proxy;

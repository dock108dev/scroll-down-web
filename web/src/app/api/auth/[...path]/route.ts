import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/api-server";

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
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

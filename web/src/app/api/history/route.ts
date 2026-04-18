import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiError, forwardAuth } from "@/lib/api-server";
import { verifySession } from "@/lib/magic-link";
import { STORAGE_KEYS } from "@/lib/config";
import type { GameListResponse } from "@/lib/types";

function checkPro(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") {
    const param = req.nextUrl.searchParams.get("tier");
    if (param === "pro") return null;
    if (param === "free") return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const sessionCookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (sessionCookie) {
    const payload = verifySession(sessionCookie);
    if (payload?.tier === "pro") return null;
  }

  return NextResponse.json({ error: "pro_required" }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const gate = checkPro(req);
  if (gate) return gate;

  const { searchParams } = req.nextUrl;
  // Strip the dev tier override before forwarding to the backend
  const fwdParams = new URLSearchParams(searchParams.toString());
  fwdParams.delete("tier");
  const qs = fwdParams.toString();
  const path = `/api/admin/sports/games${qs ? `?${qs}` : ""}`;

  try {
    const data = await apiFetch<GameListResponse>(path, {
      headers: forwardAuth(req),
      revalidate: 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError && err.proxyStatus ? err.proxyStatus : 500;
    return NextResponse.json({ error: "Failed to fetch history" }, { status });
  }
}

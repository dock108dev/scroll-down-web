import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS, allowDevTierUrlOverrides } from "@/lib/config";
import { verifySession } from "@/lib/magic-link";

/**
 * Server-side Pro gate. Returns a 402 NextResponse when the request does not
 * carry a valid Pro-tier session, or null when access is allowed. Callers
 * should return the response immediately if it is not null:
 *
 *   const gate = requirePro(req);
 *   if (gate) return gate;
 *
 * The tier is read from the signed, HttpOnly session JWT — not from the
 * client-writable sd-tier cookie — so it cannot be spoofed by the browser.
 */
export function requirePro(req: NextRequest): NextResponse | null {
  // Dev / Playwright: ?tier=pro bypasses the gate without a session cookie.
  if (allowDevTierUrlOverrides()) {
    const param = req.nextUrl.searchParams.get("tier");
    if (param === "pro") return null;
  }

  const sessionCookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (sessionCookie) {
    const payload = verifySession(sessionCookie);
    if (payload?.tier === "pro") return null;
  }

  return NextResponse.json({ error: "pro_required" }, { status: 402 });
}

/**
 * Extract the anonymous ID from the incoming request cookies. Returns null
 * when the visitor has not yet initialized the tier store on the client.
 */
export function getAnonId(req: NextRequest): string | null {
  return req.cookies.get(STORAGE_KEYS.ANON_ID)?.value ?? null;
}

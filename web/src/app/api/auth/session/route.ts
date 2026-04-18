import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";
import {
  verifySession,
  buildRefreshedSessionCookie,
  buildSessionCookieHeader,
  buildTierCookieHeader,
} from "@/lib/magic-link";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = verifySession(cookie);
  if (!payload) {
    return NextResponse.json({ authenticated: false });
  }

  // Check whether the account tier changed since the JWT was issued
  // (e.g. Stripe webhook fired while this session was alive).
  const refreshed = buildRefreshedSessionCookie(payload.email, payload.userId);
  const tier = refreshed?.tier ?? payload.tier;

  const res = NextResponse.json({
    authenticated: true,
    userId: payload.userId,
    email: payload.email,
    tier,
  });

  if (refreshed && refreshed.tier !== payload.tier) {
    // Re-issue JWT and sd-tier so the browser picks up the new tier
    res.headers.append("Set-Cookie", buildSessionCookieHeader(refreshed.cookieValue));
    res.headers.append("Set-Cookie", buildTierCookieHeader(refreshed.tier));
  }

  return res;
}

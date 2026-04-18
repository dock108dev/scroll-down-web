import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS, AUTH } from "@/lib/config";
import { consumeMagicToken, findOrCreateAccount, signSession } from "@/lib/magic-link";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const consumed = consumeMagicToken(token);
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const { email, anonId } = consumed;
  const account = findOrCreateAccount(email, anonId);

  let sessionJwt: string;
  try {
    sessionJwt = signSession(
      { userId: account.id, email: account.email, tier: account.tier },
      AUTH.SESSION_TTL_S,
    );
  } catch (err) {
    console.error("[verify] session signing failed:", err);
    return NextResponse.redirect(new URL("/login?error=server_error", req.url));
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(STORAGE_KEYS.SESSION, sessionJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH.SESSION_TTL_S,
    path: "/",
  });

  return response;
}

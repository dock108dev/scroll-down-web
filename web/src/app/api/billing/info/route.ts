import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";
import { verifySession, findAccountByEmail } from "@/lib/magic-link";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = verifySession(cookie);
  if (!payload) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const account = findAccountByEmail(payload.email);

  return NextResponse.json({
    email: payload.email,
    tier: account?.tier ?? payload.tier,
    nextBillingDate: account?.nextBillingDate ?? null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";
import { verifySession, findAccountByEmail } from "@/lib/magic-link";
import { getStripe } from "@/lib/stripe";
import { publicBaseUrl } from "@/lib/public-url";

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
  if (!account?.stripeCustomerId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${publicBaseUrl(req)}/account`,
  });

  return NextResponse.redirect(portalSession.url, { status: 303 });
}

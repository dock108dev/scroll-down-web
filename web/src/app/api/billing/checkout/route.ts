import { NextRequest, NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";
import { verifySession } from "@/lib/magic-link";
import { findAccountByEmail, updateAccountTier } from "@/lib/magic-link";
import { getStripe, getPriceId } from "@/lib/stripe";
import { publicBaseUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(STORAGE_KEYS.SESSION)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const payload = verifySession(cookie);
  if (!payload) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let plan: "monthly" | "annual" = "monthly";
  try {
    const body = (await req.json()) as { plan?: string };
    if (body.plan === "annual") plan = "annual";
  } catch {
    // default to monthly if body parse fails
  }

  const priceId = getPriceId(plan);
  const stripe = getStripe();
  const base = publicBaseUrl(req);

  const account = findAccountByEmail(payload.email);
  const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/?upgraded=1`,
    cancel_url: `${base}/`,
    allow_promotion_codes: true,
    metadata: { userId: payload.userId, email: payload.email },
  };

  if (account?.stripeCustomerId) {
    params.customer = account.stripeCustomerId;
  } else {
    params.customer_email = payload.email;
  }

  const session = await stripe.checkout.sessions.create(params);

  // If Stripe created a new customer, persist the ID now so portal works later
  if (!account?.stripeCustomerId && session.customer) {
    updateAccountTier(payload.email, payload.tier, session.customer as string);
  }

  return NextResponse.json({ url: session.url });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import {
  findAccountByEmail,
  findAccountByStripeCustomerId,
  updateAccountTier,
} from "@/lib/magic-link";
import { signSession } from "@/lib/magic-link";
import { AUTH, STORAGE_KEYS } from "@/lib/config";

export const dynamic = "force-dynamic";

// Stripe requires the raw body for signature verification — do not parse JSON
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, getWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email =
        (session.metadata?.email as string | undefined) ?? session.customer_email;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      if (email) {
        updateAccountTier(email, "pro", customerId ?? undefined);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;

      if (customerId) {
        const account = findAccountByStripeCustomerId(customerId);
        if (account) {
          updateAccountTier(account.email, "free");
        }
      }
      break;
    }

    default:
      // Unhandled event — acknowledge so Stripe doesn't retry
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Re-issue the session cookie with a fresh tier from the account store.
 * Called by the session route so tier changes from webhooks propagate
 * to the browser within one page load.
 */
export function buildRefreshedSessionCookie(
  email: string,
  userId: string,
): { cookieValue: string; tier: "free" | "pro" } | null {
  const account = findAccountByEmail(email);
  if (!account) return null;
  const token = signSession(
    { userId, email, tier: account.tier },
    AUTH.SESSION_TTL_S,
  );
  return { cookieValue: token, tier: account.tier };
}

export function buildTierCookieHeader(tier: "free" | "pro"): string {
  const maxAge = 365 * 24 * 60 * 60;
  return `${STORAGE_KEYS.TIER}=${tier}; Max-Age=${maxAge}; Path=/; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function buildSessionCookieHeader(token: string): string {
  const maxAge = AUTH.SESSION_TTL_S;
  return `${STORAGE_KEYS.SESSION}=${token}; HttpOnly; Max-Age=${maxAge}; Path=/; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

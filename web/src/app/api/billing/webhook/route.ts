import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import {
  findAccountByStripeCustomerId,
  updateAccountTier,
} from "@/lib/magic-link";

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
    // Surface signature failures in logs so a misconfigured webhook secret or
    // an active forgery attempt is visible. The 400 body is generic to avoid
    // confirming what failed to the caller.
    console.error("[billing/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Only upgrade on confirmed payment — free trials and incomplete sessions
      // also fire checkout.session.completed with payment_status !== "paid".
      if (session.payment_status !== "paid") break;

      const email =
        (session.metadata?.email as string | undefined) ?? session.customer_email;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      if (email) {
        updateAccountTier(email, "pro", customerId ?? undefined);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;
      // current_period_end moved to SubscriptionItem in Stripe v22
      const periodEnd = sub.items.data[0]?.current_period_end;

      if (customerId && periodEnd) {
        const account = findAccountByStripeCustomerId(customerId);
        if (account) {
          const nextBillingDate = new Date(periodEnd * 1000).toISOString();
          updateAccountTier(account.email, account.tier, undefined, nextBillingDate);
        } else {
          // No matching local account for a Stripe customer means our
          // accounts file is out of sync with Stripe — log so it can be
          // reconciled. See docs/audits/error-handling-report.md §B1.
          console.warn(
            `[billing/webhook] ${event.type}: no local account for stripeCustomerId=${customerId} (event.id=${event.id})`,
          );
        }
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
          updateAccountTier(account.email, "free", undefined, undefined);
        } else {
          // Subscription deleted for an unknown customer — same drift as
          // above, but lets a paid user keep Pro indefinitely until manual
          // reconciliation. See docs/audits/error-handling-report.md §B1.
          console.warn(
            `[billing/webhook] subscription.deleted: no local account for stripeCustomerId=${customerId} (event.id=${event.id}) — Pro entitlement may not have been revoked`,
          );
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

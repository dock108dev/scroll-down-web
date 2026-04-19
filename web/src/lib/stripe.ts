import Stripe from "stripe";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY env var is not set");
  return key;
}

let _stripe: Stripe | null = null;

/** Lazy singleton — never instantiated at import time so the key is only read on first use. */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

export function getWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET env var is not set");
  return s;
}

export function getPriceId(plan: "monthly" | "annual"): string {
  const key =
    plan === "annual" ? "STRIPE_PRICE_ID_ANNUAL" : "STRIPE_PRICE_ID_MONTHLY";
  const id = process.env[key];
  if (!id) throw new Error(`${key} env var is not set`);
  return id;
}

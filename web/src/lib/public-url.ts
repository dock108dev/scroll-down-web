import type { NextRequest } from "next/server";

/**
 * Resolve the public origin for outbound URLs that we hand to third parties
 * (magic-link emails, Stripe success/cancel/return URLs).
 *
 * The unsafe pattern this replaces was `${proto}://${host}` built from
 * `req.headers.get("host")` and `x-forwarded-proto`. Both headers are
 * attacker-controllable on the inbound request unless the upstream proxy
 * strips them, so a forged Host header could redirect a magic-link email or
 * a Stripe checkout return to an attacker-controlled origin.
 *
 * Resolution order:
 *  1. `PUBLIC_BASE_URL` env (preferred — explicit per-deploy config).
 *  2. `MAGIC_LINK_BASE_URL` env (legacy alias kept so existing deploys keep
 *     working without an env-var rename).
 *  3. In production NODE_ENV: the hardcoded canonical site URL.
 *  4. In non-production: the request's `host` header — host-header injection
 *     in dev is acceptable because attackers don't reach dev hosts.
 *
 * See docs/audits/security-report.md §H1.
 */

const CANONICAL_PROD_BASE_URL = "https://scrolldownsports.dev";

function trimTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

export function publicBaseUrl(req: NextRequest): string {
  const explicit = process.env.PUBLIC_BASE_URL ?? process.env.MAGIC_LINK_BASE_URL;
  if (explicit) return trimTrailingSlash(explicit);

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_PROD_BASE_URL;
  }

  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

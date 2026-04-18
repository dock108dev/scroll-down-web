# Security Audit — Scroll Down Sports

**Date**: 2026-04-18  
**Auditor**: Claude (AI security review, Sonnet 4.6)  
**Branch**: `aidlc_1`  
**Scope**: Full codebase — Next.js 16 App Router frontend with custom auth, Stripe billing, AI story generation  

---

## Executive Summary

The app has a solid security foundation: CSP headers, HSTS, HttpOnly session cookie, HMAC-signed JWTs, Stripe webhook signature verification, anti-enumeration on auth endpoints, and rate limiting on the critical magic-link flow. The most serious issue found is that the **Pro paywall gate was designed to read from a client-writable cookie** (fixed in this review). A second urgent issue: the **AI story endpoint had no authentication or rate limiting**, allowing any anonymous visitor to drain Anthropic API credits. Both have been patched directly. Several architectural risks remain that require manual follow-up.

---

## Part 1 — Confirmed Vulnerabilities (Fixed)

### F-1 · HIGH — Pro Gate Reads Client-Writable Cookie  
**File**: `web/src/lib/pro-gate.ts` (original lines 19–20)  
**Status**: **Fixed in this audit**

`requirePro()` checked `req.cookies.get("sd-tier")`, but that cookie is set by client-side JavaScript in `web/src/stores/tier.ts` (line 33) with no `HttpOnly` or `Secure` flags:

```typescript
// tier.ts – runs in the browser
document.cookie = `${STORAGE_KEYS.TIER}=${tier}; path=/; max-age=${maxAge}; SameSite=Lax`;
```

Any user could open DevTools console and run:
```javascript
document.cookie = "sd-tier=pro; path=/"
```
…then call any route protected by `requirePro` to receive Pro-tier data for free.

**Fix applied**: `requirePro` now reads the **signed, HttpOnly `sd-session` JWT** and calls `verifySession()`. The tier value in the JWT is HMAC-SHA256–signed and cannot be forged without the `MAGIC_LINK_SECRET`.

> **Note**: `requirePro` currently has no callers — server-side paywall enforcement is not yet wired to any API route (see R-1 below). The fix hardens the implementation before it is deployed.

---

### F-2 · HIGH — AI Story Endpoint: No Auth, No Rate Limiting  
**Files**: `web/src/app/api/ai/story/route.ts`, `/salient-events/route.ts`, `/verify/route.ts`  
**Status**: **Fixed in this audit**

`POST /api/ai/story` made a call to the Anthropic Claude API for every request, with zero authentication and zero rate limiting. An attacker could script thousands of requests to exhaust the `ANTHROPIC_API_KEY` quota and incur large API costs.

**Fix applied**:
- `/api/ai/story` now requires a **valid session cookie** (returns 401 otherwise) and enforces **10 requests/minute/IP**.
- `/api/ai/salient-events` and `/api/ai/verify` enforce **30 requests/minute/IP** (CPU-only, no external API calls).

---

### F-3 · LOW — Feedback Endpoint Logged Unbounded `storyId`  
**File**: `web/src/app/api/story-feedback/route.ts`  
**Status**: **Fixed in this audit**

`storyId` was only checked for truthiness, allowing arbitrarily long strings that would be logged verbatim via `console.log(JSON.stringify(...))`. An attacker could bloat application logs.

**Fix applied**: `storyId` is now rejected with 400 if it exceeds 128 characters.

---

## Part 2 — Risky Patterns / Hardening Opportunities

### R-1 · CRITICAL — No Server-Side Pro Gate on Any API Route

`requirePro()` exists and is now correct, but **no API route calls it**. All Pro feature gating is enforced entirely on the client via `useProGate` / `useTier.isAllowed()`. This means:

- `GET /api/fairbet/live` — live in-game odds (marked as Pro-gated in the product) — is accessible to any unauthenticated caller.
- `GET /api/fairbet/live/games` — same.

**Exploit scenario**: A free user who inspects network traffic can call these endpoints directly, bypassing the client-side gate completely.

**Recommendation**: Each Pro-gated API route must call `requirePro(req)` at the top of its handler. For example:

```typescript
// web/src/app/api/fairbet/live/route.ts
import { requirePro } from "@/lib/pro-gate";

export async function GET(req: NextRequest) {
  const gate = requirePro(req);
  if (gate) return gate;
  // ...existing logic
}
```

Apply to: `/api/fairbet/live`, `/api/fairbet/live/games`, and any future Pro feature routes.

---

### R-2 · HIGH — Account Store: Flat JSON File, Race Condition, Ephemeral Default Path

**File**: `web/src/lib/magic-link.ts`, lines 106–175

The account database is a JSON file (`sd-accounts.json`). Every write is a read-modify-write with no file locking:

```typescript
function findOrCreateAccount(email, anonId) {
  const accounts = loadAccounts();  // read
  // ...mutate...
  saveAccounts(accounts);           // write — not atomic
}
```

Two concurrent sign-ins for the same email can produce a race where one write silently overwrites the other. Additionally, the default `DATA_DIR` is `/tmp`, which is cleared on reboot on many Linux systems, **wiping all user accounts and Stripe customer ID mappings**.

**Recommendations**:
1. Document `DATA_DIR` as a required production env var; add a startup warning if unset or pointing to `/tmp`.
2. Use a write-and-rename pattern or a lightweight embedded DB (SQLite via `better-sqlite3`) for atomic writes.
3. Short-term: add a startup check — `if (dataDir() === "/tmp") console.warn("[WARN] DATA_DIR is /tmp — accounts will not survive reboot")`.

---

### R-3 · HIGH — Magic Link URL Built from Untrusted `Host` Header

**File**: `web/src/app/api/auth/send-link/route.ts`, lines 23–29

When `MAGIC_LINK_BASE_URL` is not set, the magic link URL is built from the `host` and `x-forwarded-proto` request headers:

```typescript
const host = req.headers.get("host") ?? "localhost:3001";
const proto = req.headers.get("x-forwarded-proto") ?? "http";
return `${proto}://${host}`;
```

A misconfigured reverse proxy that forwards arbitrary `Host` headers would allow an attacker to generate a magic link pointing to `https://attacker.com/api/auth/verify?token=...`. If the victim clicks the link, the token is delivered to the attacker's server.

**Recommendations**:
1. **Always set `MAGIC_LINK_BASE_URL`** in production and document it as required.
2. Add a startup assertion that warns if the variable is unset in production.
3. Optionally validate the derived `host` against an allowlist of known domains as a fallback.

---

### R-4 · MEDIUM — `script-src 'unsafe-inline'` Weakens XSS Protection

**File**: `web/next.config.ts`, line 23

```
"script-src 'self' 'unsafe-inline' ..."
```

`'unsafe-inline'` allows any inline `<script>` to execute, which nullifies XSS protection from the CSP. If an attacker can inject a script tag (e.g., via a stored XSS through a data field rendered to the DOM), the CSP will not block it.

**Recommendation**: Adopt [CSP nonces](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy) via Next.js Middleware. Next.js 15+ has first-class support for nonce-based CSP, generating a per-request nonce and injecting it into all `<script>` tags and the CSP header. This is a non-trivial change but significantly hardens XSS defenses.

---

### R-5 · MEDIUM — Analytics Routes Lack Local Authorization Check

**Files**: `web/src/app/api/analytics/**` (16 routes)

These routes proxy sensitive admin operations (model training, batch simulation, model activation) to the backend by forwarding the client's `Authorization` header. The Next.js layer does **not** verify the session or role before forwarding — it trusts the backend to reject unauthorized calls.

This is defense-in-depth that's missing: if the backend misconfigures its auth, the proxy will happily relay the request.

**Recommendation**: Add a local session + role check before forwarding:

```typescript
const payload = verifySession(req.cookies.get(STORAGE_KEYS.SESSION)?.value ?? "");
if (!payload || payload.role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

This requires adding a `role` field to `SessionPayload` in `magic-link.ts` and populating it from the account store.

---

### R-6 · MEDIUM — Billing Return URLs Derived from Untrusted Headers

**Files**: `web/src/app/api/billing/checkout/route.ts` (line 10), `web/src/app/api/billing/portal/route.ts` (line 11)

`success_url`, `cancel_url`, and `return_url` for Stripe sessions are built from the `host` and `x-forwarded-proto` headers without validation (same pattern as R-3). Stripe validates return URLs against the configured domain in the dashboard, so this is likely not exploitable in practice, but it's a weaker design than using a configured env var.

**Recommendation**: Use a shared `APP_BASE_URL` (or `MAGIC_LINK_BASE_URL`) env var for all origin derivation, rather than reading from request headers.

---

### R-7 · MEDIUM — In-Memory Token Store and Rate Limiter (Single-Instance Constraint)

**Files**: `web/src/lib/magic-link.ts` (line 65), `web/src/lib/rate-limit.ts`

Both the pending magic tokens (`TOKENS` Map) and the rate limiter state are in-process memory. On a single Hetzner VPS this is acceptable, but:

- A process restart (deploy, crash, OOM kill) invalidates all pending magic links with no user-visible error.
- If the deployment ever load-balances across multiple processes, tokens and rate limits won't be shared.

**Recommendation**: Document the single-instance constraint explicitly in deployment docs. If scaling is planned, both must move to a shared store (Redis, Upstash, etc.).

---

### R-8 · LOW — Tier and Anon Cookies Lack `Secure` Flag

**File**: `web/src/stores/tier.ts`, lines 32–33

```typescript
document.cookie = `${STORAGE_KEYS.TIER}=${tier}; path=/; max-age=${maxAge}; SameSite=Lax`;
document.cookie = `${STORAGE_KEYS.ANON_ID}=${anonId}; path=/; max-age=${maxAge}; SameSite=Lax`;
```

Both cookies are set without the `Secure` flag. HSTS (`max-age=63072000; preload`) in `next.config.ts` provides strong protection in practice, but belt-and-suspenders is the right default.

Since `requirePro` now reads the signed session JWT, the `sd-tier` cookie is informational only (cannot grant server-side access). Risk is low but worth fixing.

**Recommendation**: Set `; Secure` on both cookies (gated on `window.location.protocol === "https:"` for local dev compatibility).

---

### R-9 · LOW — Custom JWT Implementation

**File**: `web/src/lib/magic-link.ts`, lines 25–55

The app implements JWT signing and verification from scratch using Node.js crypto. The implementation is functionally correct (timing-safe comparison via `timingSafeEqual`, expiry validation, proper b64url encoding). However:

- The `alg` header field is not validated on verification — only the signature and expiry are checked. This is safe for this codebase's single-algorithm use, but deviates from the JWT spec.
- Custom crypto is a maintenance risk compared to a maintained library.

**Recommendation**: Consider migrating to `jose` (zero-dependency, edge-compatible, spec-compliant) when the auth system next needs changes. Not urgent given current correctness.

---

### R-10 · INFORMATIONAL — `devToken` in Non-Production Responses

**File**: `web/src/app/api/auth/send-link/route.ts`, lines 73–76

The raw magic token is included in the response body when `NODE_ENV !== "production"`. This is intentional for E2E testing. Ensure any publicly-accessible staging or preview environment sets `NODE_ENV=production` to suppress this.

---

## Part 3 — Intentional / Acceptable Patterns

| Pattern | Location | Assessment |
|---------|----------|------------|
| Always return 200 for magic-link requests | `send-link/route.ts:49–56` | Correct — prevents email enumeration |
| `timingSafeEqual` for HMAC comparison | `magic-link.ts:46` | Correct — prevents timing attacks |
| Stripe webhook: raw body + signature verify | `billing/webhook/route.ts:16–28` | Correct — must not pre-parse body |
| Path whitelist on legacy auth proxy | `api/auth/[...path]/route.ts:9–21` | Good defense-in-depth |
| `no-store` cache header on all `/api/*` | `next.config.ts:41` | Correct — prevents CDN caching of user data |
| `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `next.config.ts` | Redundant but harmless |
| `base-uri 'self'` in CSP | `next.config.ts:31` | Correct — prevents base tag injection |
| `form-action 'self'` in CSP | `next.config.ts:32` | Correct — blocks form exfiltration |
| IP anonymization in analytics | `analytics-event/route.ts:30–38` | Privacy-correct — last octet zeroed |
| `SameSite=Lax` on session cookie | `verify/route.ts:35` | Provides CSRF protection for most mutations |
| `HttpOnly` + `Secure` on session cookie | `verify/route.ts:32–37` | Correct — JS cannot read the JWT |
| One-time magic token consumption | `magic-link.ts:83–91` | Correct — `TOKENS.delete(token)` before expiry check |
| Rate limiting on auth endpoints | `send-link/route.ts:10–13`, `[...path]/route.ts:27–37` | Good — prevents spray/brute-force |

---

## Part 4 — Items Needing Manual Verification

### M-1 — Backend Authorization on Analytics Routes

The analytics proxy routes forward the client's `Authorization` header to `sda.dock108.dev`. **Verify** that the backend enforces admin role checks for sensitive operations (model activation, training, batch simulation). If the backend ever accepts the shared `X-API-Key` as sufficient authorization, these routes would allow any visitor to trigger expensive ML operations.

### M-2 — Session Cookie Tier Staleness After Stripe Webhook

After a user upgrades to Pro (Stripe webhook fires → `updateAccountTier`), the session JWT is re-issued on the next `GET /api/auth/session` call. Once `requirePro` is wired to API routes (R-1), verify that there is no window where a user's subscription is active but their session cookie still says `tier: "free"`, causing false 402 rejections. The `buildRefreshedSessionCookie` path in `session/route.ts` handles this but only if `/api/auth/session` is called before the gated route.

### M-3 — Confirm `MAGIC_LINK_BASE_URL` Is Set in Production

The magic link Host-header risk (R-3) is only mitigated if `MAGIC_LINK_BASE_URL` is set in the production environment. Confirm this in the deployment config (docker-compose, Hetzner env vars, or secrets manager).

### M-4 — Resend Error Body Logging

`sendMagicLinkEmail` logs the full Resend API error response body: `throw new Error("Resend API error ${res.status}: ${body}")`. This is caught and re-logged by the caller. Confirm that Resend's error responses do not include email addresses or user PII in a form that would appear in log aggregators.

### M-5 — SSE Channel Authorization

`GET /api/realtime/sse?channels=...` proxies arbitrary channel names to the backend with the shared `X-API-Key`. There is no per-user channel authorization in the Next.js layer. Verify whether the backend restricts channel subscriptions by user, or whether open subscription to any channel name is an acceptable design for a public sports data app.

### M-6 — Stripe `customer_email` Source

In `billing/webhook/route.ts`, `checkout.session.completed` reads the email from `session.metadata?.email ?? session.customer_email`. The `metadata.email` is set server-side (trusted), but `customer_email` is the value Stripe recorded from the checkout form, which could differ. Prefer `session.metadata.email` exclusively, or confirm that Stripe guarantees this field is the verified email.

---

## Summary Table

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| F-1 | Pro gate reads client-writable cookie | HIGH | **Fixed** |
| F-2 | AI story endpoint: no auth, no rate limit | HIGH | **Fixed** |
| F-3 | Feedback storyId length unbounded | LOW | **Fixed** |
| R-1 | No server-side Pro gate on any API route | CRITICAL | **Open** |
| R-2 | Account store: race condition + /tmp default | HIGH | **Open** |
| R-3 | Magic link URL from untrusted Host header | HIGH | **Open** |
| R-4 | `script-src 'unsafe-inline'` weakens CSP | MEDIUM | **Open** |
| R-5 | Analytics routes lack local auth check | MEDIUM | **Open** |
| R-6 | Billing return URLs from untrusted headers | MEDIUM | **Open** |
| R-7 | In-memory token store + rate limiter | MEDIUM | Acceptable/documented |
| R-8 | Tier cookie lacks Secure flag | LOW | **Open** |
| R-9 | Custom JWT implementation | LOW | Acceptable |
| R-10 | devToken in non-production responses | INFO | Intentional |
| M-1–M-6 | Manual verification items | — | Needs review |

### Recommended Priority Order

1. **R-1** — wire `requirePro` to Pro-gated routes (actual paywall enforcement)
2. **R-2** — account store durability before real users sign up
3. **M-3 / R-3** — confirm `MAGIC_LINK_BASE_URL` is set in production; add startup assertion
4. **R-4** — CSP nonce migration (plan for dedicated sprint)
5. **R-5** — analytics route role check (blocks until role field added to session)
6. **R-8** — Secure flag on tier/anon cookies (5-minute fix)
7. **R-6** — billing return URL env var (cleanup)

---

## Addendum — Second-Pass Review (2026-04-18)

Additional findings from deep inspection of new routes added in this branch cycle.

### F-4 · HIGH — Stripe `checkout.session.completed` Grants Pro Without Payment Confirmation
**File**: `web/src/app/api/billing/webhook/route.ts` (line 35)
**Status**: **Fixed in this review**

`checkout.session.completed` fires for free trials (payment_status=`"unpaid"`) and other non-payment scenarios, not just completed purchases. The original handler upgraded the account to Pro unconditionally:

```typescript
// Before fix
if (email) {
  updateAccountTier(email, "pro", customerId ?? undefined);
}
```

A user starting a free trial without a payment method would be silently upgraded to Pro indefinitely (until `customer.subscription.deleted` fires on trial expiry — which may not happen on all cancellation paths).

**Fix applied**: Added `if (session.payment_status !== "paid") break;` guard before tier upgrade.

> Note: M-6 in the original audit flagged `customer_email` source ambiguity in this same handler — that remains an open item.

---

### F-5 · LOW — Account Store /tmp Warning Missing at Startup
**File**: `web/src/lib/magic-link.ts`
**Status**: **Fixed in this review**

R-2 recommended a startup warning when `DATA_DIR` defaults to `/tmp` in production. That warning was not implemented.

**Fix applied**: `dataDir()` now emits a `console.warn` when `DATA_DIR` is `/tmp` and `NODE_ENV === "production"`.

---

### R-11 · MEDIUM — Dev-Mode Auth Bypass via URL Query Parameter

**Files**: `web/src/app/api/sync/reveal/route.ts` (lines 14–22), `web/src/app/api/history/route.ts` (lines 8–17)

Both routes accept `?tier=pro&userId=arbitrary` to bypass session authentication when `NODE_ENV !== "production"`:

```typescript
if (process.env.NODE_ENV !== "production") {
  const param = req.nextUrl.searchParams.get("tier");
  if (param === "pro") {
    const devUserId = req.nextUrl.searchParams.get("userId") ?? "dev-user";
    return { userId: devUserId, email: "dev@test.example" };
  }
}
```

Any user who knows this pattern can access Pro-gated reveal sync data and historical game data if a staging/preview environment runs without `NODE_ENV=production`. The `userId` is fully attacker-controlled, meaning any user ID can be impersonated.

**Recommendation**: Ensure all non-localhost deployments (staging, preview, CI) set `NODE_ENV=production`. If dev bypass is needed in staging, gate it behind a separate secret env var (e.g., `DEV_AUTH_BYPASS_KEY`) that is never set in any shared environment.

---

### R-12 · MEDIUM — SSE Proxy Subscribes Channels Without Per-User Authorization

**File**: `web/src/app/api/realtime/sse/route.ts`

The SSE proxy accepts an arbitrary `channels` query parameter and forwards it to the backend with only the server-side `X-API-Key`:

```typescript
const channels = req.nextUrl.searchParams.get("channels") || "";
const url = `${BASE_URL}/v1/sse?channels=${encodeURIComponent(channels)}`;
```

There is no session check — unauthenticated users can subscribe to any channel name. Covered partially in M-5 but worth elevating: if the backend trusts channel subscriptions based only on `X-API-Key` (no per-user scoping), an attacker can subscribe to channels for any game or user by guessing or enumerating channel names.

**Recommendation**: Verify backend channel authorization model (M-5). If channels carry user-private data (e.g., `user:<id>:*` channels for future private features), add session validation in the proxy before forwarding.

---

### Updated Summary Table

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| F-4 | Stripe checkout upgrades tier without payment confirmation | HIGH | **Fixed** |
| F-5 | No /tmp startup warning for account store | LOW | **Fixed** |
| R-11 | Dev-mode auth bypass via URL param (sync/history routes) | MEDIUM | **Open** |
| R-12 | SSE proxy subscribes channels without user auth | MEDIUM | Open/verify backend |

# Security Audit — Scroll Down Sports

**Date:** 2026-04-18  
**Auditor:** Claude (Sonnet 4.6) — automated deep code review  
**Branch:** `aidlc_1`  
**Scope:** Full codebase — auth, API proxy, transport, frontend, deps, config

---

## Executive Summary

The application has a solid security posture for its threat model. The proxy-first architecture keeps secrets server-side, CSP is well-configured, rate limiting is in place, and no hardcoded credentials exist. Three medium-severity issues warrant fixing. Several lower-severity patterns are documented below.

---

## 1. Confirmed Vulnerabilities

### MEDIUM — Open Redirect Bypass via Backslash (`/login?redirect=`)

**File:** `web/src/app/login/page.tsx:42`  
**Status:** Fixed in this audit.

**Evidence (before fix):**
```typescript
const redirectTo = rawRedirect && /^\/[^/]/.test(rawRedirect) ? rawRedirect : null;
```

**Problem:** The regex `^\/[^/]` excludes `//evil.com` but does not exclude `/\evil.com`. Browsers (Chromium, Firefox) normalize `\` to `/` in URL paths, so `router.push("/\evil.com")` navigates to `//evil.com` → `https://evil.com`.

**Exploit scenario:** Attacker sends `https://app.example/login?redirect=/\evil.com`. After login, user is redirected to an attacker-controlled site. Phishing or session-theft follow-on.

**Fix applied:**
```typescript
// Added \\ to excluded characters
const redirectTo = rawRedirect && /^\/[^/\\]/.test(rawRedirect) ? rawRedirect : null;
```

---

### MEDIUM — One-Time Tokens Exposed in URL Query Parameters

**Files:**  
- `web/src/app/auth/magic-link/page.tsx` — `searchParams.get("token")`  
- `web/src/app/auth/reset-password/page.tsx` — `router.replace(\`/reset-password?token=${token}\`)`

**Evidence:**
```typescript
// magic-link/page.tsx
const token = searchParams.get("token");
// ...
await verifyMagicLink(token);

// reset-password/page.tsx
router.replace(token ? `/reset-password?token=${token}` : "/reset-password");
```

**Problem:** Password-reset and magic-link tokens appear in browser history, server access logs, and `Referer` headers when any resource (even a favicon) is loaded from an external origin. A single token exposure allows account takeover.

**Exploit scenario:** User resets password on a shared computer. Browser history contains `https://app.example/reset-password?token=<valid-token>`. Next user on that machine completes the account takeover.

**Recommended fix:** The backend should issue the token as a short-lived signed value that is exchanged for a session cookie on a POST-only endpoint. The email link should use a URL hash fragment (`#token=...`), which is never sent to servers in the `Referer` header. Alternatively, accept tokens only via `POST` body (not query string), which requires a landing page that immediately POSTs the token.

**Note:** This is a flow controlled largely by the backend email template. Frontend cannot fully fix this unilaterally, but the reset-password page's intermediate redirect (`router.replace(…?token=${token})`) adds an unnecessary second URL exposure and can be removed — just read the token once from the initial URL without re-emitting it.

---

### MEDIUM — JWT Stored in localStorage (XSS-accessible)

**File:** `web/src/stores/auth.ts`  
**Storage key:** `sd-auth`

**Evidence:**
```typescript
// auth.ts — Zustand persist config
partialize: (s) => ({
  token: s.token,
  role: s.role,
  email: s.email,
  userId: s.userId,
  rememberMe: s.rememberMe,
}),
```

**Problem:** `localStorage` is readable by any JavaScript executing on the origin. If an XSS vulnerability is introduced (even via a dependency), the attacker can exfiltrate JWTs silently.

**Mitigating factors (why this is Medium, not High):**
- CSP restricts `script-src` to `'self'` + `'unsafe-inline'` + `plausible.io` — no arbitrary external scripts
- No `dangerouslySetInnerHTML` or `eval` usage found in codebase
- `frame-ancestors 'none'` prevents clickjacking

**Recommended fix:** Migrate to `HttpOnly` + `SameSite=Strict` cookies managed by the backend. The `/api/auth/*` proxy layer makes this feasible without exposing the backend URL. Until then, the current risk is acceptable given the CSP.

---

## 2. Risky Patterns / Hardening Opportunities

### LOW — Path Parameters Not Validated Before Forwarding to Backend

**Files:** `web/src/app/api/games/[id]/route.ts`, `games/[id]/flow/route.ts`, `golf/tournaments/[eventId]/route.ts`, `golf/tournaments/[eventId]/leaderboard/route.ts`, `analytics/batch-simulate-job/[id]/route.ts`

**Evidence:**
```typescript
const { id } = await params;
const data = await apiFetch<GameDetailResponse>(
  `/api/admin/sports/games/${id}`,  // id is raw string, no validation
  ...
);
```

**Contrast:** `/api/simulator/[sport]/route.ts` correctly whitelists sport values. Auth proxy correctly whitelists paths.

**Problem:** If `id` contains `..%2F` or other encoded characters, it could (depending on backend URL routing) hit unintended endpoints. Next.js does not strip these from dynamic segments.

**Risk level:** Low — the backend is the authoritative security boundary and presumably validates its own IDs. The proxy's role is defense-in-depth.

**Recommended fix:** Add lightweight validation for IDs expected to be numeric:
```typescript
const { id } = await params;
if (!/^\d+$/.test(id)) {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 });
}
```
For `eventId` (string), validate against a known pattern (e.g., alphanumeric + hyphens only).

---

### LOW — In-Memory Rate Limiter (Single-Instance Only)

**File:** `web/src/lib/rate-limit.ts`

**Evidence:** A sliding-window Map-based implementation with a 60-second prune interval. Noted in the code that Redis is needed for multi-instance deployments.

**Problem:** Rate limits are not shared across Node.js processes. If the app is ever load-balanced, brute-force attacks can circumvent rate limiting by distributing requests across instances.

**Recommended fix:** When scaling horizontally, replace with Redis-backed rate limiting (e.g., `rate-limiter-flexible` with a Redis store). For now, single-VPS deployment makes this acceptable.

---

### LOW — SSE Channel Parameter Unvalidated

**File:** `web/src/app/api/realtime/sse/route.ts:8`

**Evidence:**
```typescript
const channels = req.nextUrl.searchParams.get("channels") || "";
const url = `${BASE_URL}/v1/sse?channels=${encodeURIComponent(channels)}`;
```

**Problem:** `encodeURIComponent` prevents injection, but there is no whitelist or length limit on the `channels` value. A malicious or misconfigured client could subscribe to arbitrary channel names, relying entirely on backend authorization to reject invalid ones.

**Recommended fix:** Add a basic format check:
```typescript
const channels = req.nextUrl.searchParams.get("channels") ?? "";
if (channels && !/^[\w:,\-]+$/.test(channels)) {
  return new Response("Invalid channels parameter", { status: 400 });
}
```

---

### LOW — API Key Fallback to Empty String

**File:** `web/src/lib/api-server.ts:5`

**Evidence:**
```typescript
export const API_KEY =
  process.env.SPORTS_DATA_API_KEY ||
  process.env.SPORTS_API_KEY ||
  process.env.API_KEY ||
  "";  // silent empty fallback
```

**Problem:** If none of the env vars are set (misconfigured deployment), `API_KEY` is `""`. All backend requests then proceed without an API key. The backend presumably rejects them, but the failure mode is silent — no startup warning.

**Recommended fix:** Log a warning at module load time (not a crash, since dev environments may run without full config):
```typescript
if (!API_KEY) {
  console.warn("[api-server] No API key configured — backend requests will be unauthenticated");
}
```

---

### INFORMATIONAL — `unsafe-inline` in `script-src` CSP

**File:** `next.config.ts`

**Evidence:**
```
script-src 'self' 'unsafe-inline' https://plausible.io
```

**Problem:** `'unsafe-inline'` allows inline `<script>` blocks and `javascript:` URIs. If any user-controlled content is ever rendered without escaping (even via a future bug or dependency), XSS is possible.

**Context:** This is required by Next.js 13+ App Router for hydration. The framework doesn't currently support nonce-based CSP without additional configuration.

**Recommended fix (future):** Next.js supports `nonce`-based CSP injection via middleware. Evaluate `next-secure-headers` or a custom middleware that injects a per-request nonce and removes `'unsafe-inline'`. Track as a hardening backlog item.

---

### INFORMATIONAL — WebSocket Connects Directly to Backend (Bypasses Proxy)

**File:** `web/src/realtime/transport.ts`

**Evidence:**
```typescript
// WebSocket connects to wss://sda.dock108.dev directly
// (not proxied through Next.js API routes)
```

**Problem:** Unlike HTTP routes (which inject `X-API-Key` server-side), WebSocket connections go directly to the backend. JWT tokens are NOT sent in WebSocket connections — channels appear to be public/unauthenticated.

**Accepted risk:** The WebSocket only receives game score patches for public game data. No write operations occur over WebSocket. The CSP `connect-src` directive permits `wss://sda.dock108.dev` explicitly.

**If private channels are added in the future:** Tokens must not be passed in the WebSocket URL query string (leaks to logs). Use the protocol-level handshake or an authenticated SSE fallback pattern (which is already implemented).

---

## 3. Intentional / Acceptable Patterns

These were examined and are acceptable given the current architecture:

| Pattern | Rationale |
|---------|-----------|
| Auth proxy path whitelist | Excellent — explicit allowlist, 404 on unknown paths |
| Rate limiting: 8 req/min (auth), 30 req/min (account) | Appropriate limits for credential endpoints |
| Backend 401/403 mapped to 502 at proxy | Prevents auth confusion; backend misconfig ≠ user auth error |
| Generic error messages in API routes | No path or stack trace leakage to client |
| `deepFixStrings` mojibake repair at API boundary | Safe, contained, does not touch secrets |
| 5-second timeout on all `apiFetch` calls | Prevents hung requests |
| SSE proxied through Next.js (API key injected server-side) | Correct — EventSource can't set headers |
| CSP `frame-ancestors 'none'` | Prevents clickjacking |
| HSTS `max-age=63072000; includeSubDomains; preload` | Strong, correct |
| `X-Content-Type-Options: nosniff` | Correct |
| `Referrer-Policy: strict-origin-when-cross-origin` | Correct |
| `Permissions-Policy` restricting camera/mic/geolocation | Correct |
| `Cache-Control: no-store` on all `/api/*` routes | Correct — prevents CDN/proxy caching of user data |
| No `dangerouslySetInnerHTML` anywhere in codebase | Confirmed clean |
| No `eval`, `new Function`, or string-based timers | Confirmed clean |
| No hardcoded secrets in source | Confirmed clean |
| Tokens sent via `Authorization: Bearer` header (not URL) | Correct for REST calls |

---

## 4. Items Requiring Manual Verification

These could not be fully verified via static analysis alone:

| Item | What to Check |
|------|--------------|
| Backend CORS policy | Verify `Access-Control-Allow-Origin` on `sda.dock108.dev` is not `*`. Next.js proxy handles most requests, but WebSocket and any direct calls depend on backend CORS. |
| JWT expiry and rotation | Verify the backend issues short-lived JWTs (recommended: ≤1h). The 10-minute client-side refresh polling is client-enforced only. |
| Backend validates `id` / `eventId` parameters | Confirm backend rejects non-numeric game IDs and rejects unknown `eventId` strings before the proxy validation gap matters. |
| Magic-link token single-use enforcement | Verify the backend marks tokens consumed on first use. If not, a leaked URL is permanently exploitable. |
| Reset-password token expiry | Verify the backend expires reset tokens within 15–30 minutes of issuance. |
| Plausible.io data sharing | `script-src` and `connect-src` allow `https://plausible.io`. Verify Plausible is configured in self-hosted or EU-hosted mode if GDPR compliance is required. |
| `X-Forwarded-For` header trust | The rate limiter reads `X-Forwarded-For`. Confirm the Nginx/Hetzner reverse proxy is the only source of this header so clients can't spoof their IP. |
| Preference sync endpoint authorization | `GET/PUT /api/auth/me/preferences` proxied without additional role checks. Verify backend enforces user-owns-preferences invariant. |

---

## 5. Dependency Audit

**Tool:** `npm audit` (run 2026-04-18)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Moderate | 1 |
| Low | 0 |

**Moderate:** `brace-expansion < 1.1.13` — uncontrolled resource consumption via zero-step sequence (GHSA-f886-m6hf-6m8v). Affects ESLint toolchain only (devDependency). Not exploitable in production build. Fix: `npm audit fix` in the `web/` directory.

**Overall:** Dependency surface is minimal (4 production dependencies: Next.js, React, React-DOM, Zustand). No unusual or suspicious packages found.

---

## 6. Changes Made in This Audit

| File | Change | Reason |
|------|--------|--------|
| `web/src/app/login/page.tsx:42` | Regex `[^/]` → `[^/\\]` | Prevent backslash-based open redirect bypass |

No other code was modified. The remaining findings require architectural decisions or backend coordination.

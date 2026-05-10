# Security Audit & Hardening Pass — 2026-05-09

Scope: working tree against `origin/main` (the MLB-focused catchup overhaul,
plus the fixture-fed dev "Catchup Lab" tooling). The codebase has since
shrunk significantly from the prior pass (no auth, no billing, no ads, no
file-backed stores) — the previous 2026-04-29 audit appears below for
historical context but its surfaces no longer exist on this branch.

Verification:

| Check                                   | Result          |
| --------------------------------------- | --------------- |
| `npx tsc --noEmit`                      | exit 0          |
| `npx eslint --max-warnings=0 src`       | clean           |
| `vitest run` (unit)                     | 18 files / 289 passed |

## Changes made this pass

- `web/src/components/catchup/FinalReveal.tsx` — external box-score link now
  uses `rel="noopener noreferrer"` (was `noreferrer` only); closes the
  reverse-tabnabbing gap on browsers where `noreferrer` doesn't imply
  `noopener`.
- `web/src/app/layout.tsx` — inline JSON-LD now goes through the `jsonLdScript`
  helper from `@/lib/seo` instead of an unsanitized `JSON.stringify`. The
  helper escapes `<` to `<`, preventing `</script>` injection if any of
  the embedded fields ever picks up user-derived content. Today all values
  are constants, but the divergence from the helper used in `app/page.tsx`
  was a foot-gun.
- `web/next.config.ts` — CSP tightened: added explicit `object-src 'none'`
  and `frame-src 'none'`. `default-src 'self'` already covered these, but
  explicit nones close the legacy-browser fallback gap and clearly signal
  intent.
- `web/src/lib/api-server.ts` — two bounds added on the upstream-error path:
  - `ApiError`'s message now truncates the upstream body to 200 chars (full
    body still on `.body` for callers that need it). Prevents server logs
    from spilling stack traces / HTML error pages from `sda.dock108.dev`.
  - `apiFetch` caps the upstream error body it reads to 2KB before throwing
    `ApiError`. A malformed/hostile upstream can no longer make us read a
    multi-MB error page into memory.
- `web/src/app/dev/layout.tsx` (new) — server-side gate that calls
  `notFound()` when `NODE_ENV === "production"`. The Catchup Lab page at
  `/dev/catchup-lab` is dev tooling; its API endpoints are already
  `NODE_ENV`-gated, so in prod the page rendered as a perpetual loading
  shell. Defense in depth — the page is now genuinely unreachable in prod
  even if a future change re-points its data source.

## Trust boundaries reachable from this branch

```
Browser ──► Next.js (port 3001) ──► Backend API (sda.dock108.dev)
              │                       │
              ├─ /api/games/recent     ├─ /api/admin/sports/games
              │   (allowlist projection — strips score fields)
              ├─ /api/games/[gameId]/cards
              │   (numeric id; league-locked to MLB; shape-validated)
              ├─ /api/games/[gameId]/summary
              │   (numeric id; league-locked to MLB; final-score gated)
              ├─ /api/health
              └─ /api/dev/fixtures, /api/dev/fixtures/[id]/cards
                  (NODE_ENV != "production" only; numeric-only id regex)
```

There is no client-trusted state, no auth, no PII, and no user-generated
content. The only outbound link is a fixed `https://www.mlb.com/...` URL
constructed from a numeric `gameId`. The frontend renders all upstream
strings as React text nodes (no `dangerouslySetInnerHTML` over upstream
data; the only `dangerouslySetInnerHTML` sites are SEO JSON-LD blocks
built from server-controlled data, all routed through `jsonLdScript`).

## Sensitive surfaces in scope

- `SPORTS_DATA_API_KEY` / `SPORTS_API_KEY` / `API_KEY` — server-only env
  vars. Read by `sportsApiKey()` and forwarded as `X-API-Key` to the
  backend. Never exposed to the client bundle (no `NEXT_PUBLIC_*` alias).
- The fixture filesystem under `web/tests/fixtures/games/` — read by the
  dev fixture routes. Path is built as `${cwd}/tests/fixtures/games/${id}.json`
  with `id` validated against `/^[0-9]+$/`, so traversal is unreachable.

## Findings — not changed in this pass

### F1 — Rate limiter exists but is not wired up

**Severity / confidence:** Low / High.
**Evidence:** `web/src/lib/rate-limit.ts` exports a working sliding-window
limiter, but `grep -r createRateLimiter web/src` shows zero call sites.
Every API route is unrestricted. The proxy fans out to one upstream per
request, with short BFF caching that absorbs duplicate hits, so a
cold-cache flood would still apply pressure to `sda.dock108.dev`.
**Why not acted:** Wiring rate limits per-route is a behavior change with
operational risk (Playwright already needs the `NEXT_PUBLIC_SCROLLDOWN_E2E`
bypass; production has no Redis and the in-memory limiter only works for
single-instance Hetzner deploys, which is current state but a near-future
constraint). Out of scope for a behavior-preserving security pass.
**Smallest next step:** Add the limiter to `/api/games/recent` and
`/api/games/[gameId]/cards` keyed on `req.headers.get("x-forwarded-for")
?? "anon"`, with `window: 60_000, max: 120`. One-line guard at the top of
each handler. Confirm the Playwright bypass still applies before merging.

### F2 — `Cache-Control: no-store` on `/api/:path*` overrides per-route caching headers

**Severity / confidence:** Low / Medium.
**Evidence:** `web/next.config.ts` adds `Cache-Control: no-store` to
`/api/:path*`. The cards and summary routes set their own `Cache-Control`
(e.g. `private, max-age=86400, stale-if-error=604800, immutable` for
final-game cards). Next merges these per the order in `headers()` — the
config-level `no-store` is applied last and wins. Result: the per-route
caching the handlers configure isn't actually doing anything at the edge.
**Why not acted:** Both behaviors have a defensible rationale (defense-in-
depth no-store vs. immutable final-game cache hits), and choosing between
them is a product/perf decision, not a security decision. The current
state is the safer one (no-store = no edge caching of API responses), so
no action this pass.
**Smallest next step:** Decide whether final-game card payloads should be
edge-cacheable. If yes, scope the `no-store` config rule to non-cards
routes (e.g. `/api/(health|dev|games/recent)/:path*`). If no, delete the
unused `Cache-Control` headers from the route handlers so the intent is
unambiguous.

### F3 — `script-src 'unsafe-inline'` in production CSP

**Severity / confidence:** Low / High.
**Evidence:** `next.config.ts` sets `script-src 'self' 'unsafe-inline'
https://plausible.io` (plus `'unsafe-eval'` in dev). The inline scripts
that need it are the SW registration block in `layout.tsx` and the
JSON-LD blocks (now routed through `jsonLdScript`).
**Why not acted:** Removing `'unsafe-inline'` requires either nonce-per-
request CSP (Next 15+ supports this with `headers()` returning a function
or via middleware) or hashing each inline block. Both are real changes
with non-zero risk to deploy. Not behavior-preserving for a hardening pass.
**Smallest next step:** Move to nonce-based CSP via Next middleware:
generate a per-request nonce, attach to inline `<Script>` tags via the
`nonce` prop, and emit `script-src 'self' 'nonce-<nonce>'
https://plausible.io` in the CSP header. Plausible already supports
nonces. Estimated 30-line middleware addition.

## Escalations

None. Every fix above is in the working tree; every unfixed finding is
justified with a concrete next step rather than a bare TODO.

---

# Security Audit & Hardening Pass — 2026-04-29

> Historical record. The auth, billing, ads, and file-backed-store
> surfaces below have all been removed from the codebase since this pass
> ran — left in place for traceability. Trust boundaries on the current
> branch are documented in the 2026-05-09 pass above.

Scope: every diff on the working tree against `origin/main`, weighted toward
the in-flight ads rollout (Google AdSense, new ad components, broadened CSP)
and shared production-critical paths reachable from the diff (auth proxy,
magic-link send/verify, billing webhook + checkout/portal, Pro reveal-sync,
file-backed account/sync stores).

This pass acted in-place on every Critical/High finding that had a
behavior-preserving fix and on the Medium/Low findings whose remediation
fit a 1-file change. Remaining items are explicitly justified — no bare
TODOs were left behind. Verification:

| Check                 | Result          |
| --------------------- | --------------- |
| `npx tsc --noEmit`    | exit 0          |
| `npm run lint`        | clean           |
| `npm run test:unit`   | 9/9 passed      |

---

## 1. Repo Understanding

### Trust boundaries actually touched by this branch

```
Browser ──► Next.js (port 3001) ──► Backend API (sda.dock108.dev)
              │                       │
              ├─ /api/auth/[...path]   ├─ Auth (login, signup, prefs, ...)
              │   (whitelisted proxy)
              ├─ /api/auth/{send-link,verify,session,sign-out}
              │   (LOCAL — talks to sd-accounts.json + JWT)
              ├─ /api/billing/{checkout,portal,webhook,info}
              │   (local Stripe SDK + sd-accounts.json)
              ├─ /api/sync/reveal  (Pro-gated — file-backed KV)
              └─ /api/* analytics, ai, history, simulator, ...

Browser  ◄── pagead2.googlesyndication.com (NEW: AdSense loader script)
         ◄── googleads.g.doubleclick.net   (NEW: ad iframes/imgs)
         ◄── tpc.googlesyndication.com     (NEW)
         ◄── partner.googleadservices.com  (NEW)
         ◄── adservice.google.com          (NEW)
         ◄── stats.g.doubleclick.net       (NEW)
         ◄── cm.g.doubleclick.net          (NEW)
```

### Sensitive surfaces in scope

- **HMAC-signed session JWT** (`sd-session` HttpOnly cookie). Verified by
  `verifySession` in `web/src/lib/magic-link.ts`. Used to gate billing,
  reveal sync, and account routes.
- **Magic-link tokens** — 32 random bytes, single-use, 15-min TTL, in-memory
  only. Sent to user email; the link URL is built from the request host.
- **File-backed stores** under `DATA_DIR` (defaults to `/tmp` with a warn):
  `sd-accounts.json` (email, tier, Stripe customer id) and
  `sd-reveal-sync.json` (per-user reveal IDs/snapshots).
- **Stripe webhook** — only client of `STRIPE_WEBHOOK_SECRET`. Decides Pro
  upgrade/downgrade for any account.
- **AdSense surface** — third-party scripts loaded only for free-tier
  viewers, gated centrally by `useAdGate`/`shouldShowAds`.

### What this pass did NOT cover

- Backend API at `sda.dock108.dev` (out of repo).
- Service-worker caching changes (recent commits, not in the working diff).
- Anthropic SDK and AI routes (no diff against origin/main).
- Existing endpoints unrelated to the diff (history, simulator, golf).

---

## 2. Findings Table

Confidence: **H**igh (proven by code), **M**edium (likely, env-dependent),
**L**ow (defensive).

| # | Title                                                                    | Severity | Confidence | Evidence                                              | Status   |
|---|--------------------------------------------------------------------------|----------|------------|-------------------------------------------------------|----------|
| H1 | Host-header injection in magic-link & Stripe URLs                        | High     | H          | `send-link/route.ts:23-29` (pre-fix), `billing/checkout/route.ts:9-13`, `billing/portal/route.ts:8-12` | **Acted** |
| H2 | AdSense client ID interpolated into script URL without URL-encoding      | Low      | H          | `AdSenseScript.tsx:21`                                | **Acted** |
| H3 | Pro reveal-sync PUT had no body-size limit and weak shape validation     | Medium   | H          | `sync/reveal/route.ts:147-173` (pre-fix)              | **Acted** |
| H4 | Magic-link token forwarded into URL string without `encodeURIComponent`  | Low      | H          | `send-link/route.ts:65` (pre-fix)                     | **Acted** |
| J1 | `?tier=pro&userId=*` URL override gated by build-time `NEXT_PUBLIC_*`    | Medium   | H          | `sync/reveal/route.ts:18-25`, `lib/config.ts:14-19`   | Justified |
| J2 | CSP retains `'unsafe-inline'` for `script-src`; AdSense widens 3p set    | Medium   | H          | `next.config.ts:20-34`                                | Justified |
| J3 | File-backed account/sync stores have read–modify–write race              | Low      | H          | `magic-link.ts:147-151`, `sync/reveal.ts:74-94`       | Justified |
| J4 | Magic-link email HTML interpolates the link without escaping             | Low      | M          | `magic-link.ts:256-262`                               | Justified |
| J5 | `findAccountByStripeCustomerId` is O(n) over all accounts                | Low      | H          | `magic-link.ts:201-206`                               | Justified |
| J6 | Subscription not downgraded on `unpaid`/`past_due`, only on `deleted`    | Low      | M          | `billing/webhook/route.ts:73-92`                      | Justified |
| J7 | `crossOrigin="anonymous"` on AdSense loader without SRI                  | Low      | H          | `AdSenseScript.tsx:22`                                | Justified |
| J8 | `public/ads.txt` is empty (placeholder)                                  | Low      | H          | `web/public/ads.txt`                                  | Justified |
| J9 | Auth proxy whitelist allows `me/*` writes — IDOR moves up to backend      | Low      | M          | `auth/[...path]/route.ts:9-21`                        | Justified |
| J10 | Stripe `customer.subscription.created` keeps existing tier               | Low      | M          | `billing/webhook/route.ts:48-71`                      | Justified |

No Critical findings on this branch (the branch's most dangerous problem —
silent data loss on corrupt account/sync JSON — was already remediated in the
2026-04-28 error-handling pass; see `error-handling-report.md` §F1/§F2).

---

## 3. Detailed Findings

### H1 — Host-header injection in magic-link & Stripe URLs  *(Acted)*

**Severity**: High &nbsp;|&nbsp; **Confidence**: High

**Evidence (pre-fix)** — `web/src/app/api/auth/send-link/route.ts`:

```ts
function baseUrl(req: NextRequest): string {
  const configured = process.env.MAGIC_LINK_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
// ...
const link = `${baseUrl(req)}/api/auth/verify?token=${token}`;
await sendMagicLinkEmail(email, link);
```

`MAGIC_LINK_BASE_URL` is **not** documented in
`docs/env-and-config.md`, so the realistic deploy state is "fall back to
host header." `Host` and `X-Forwarded-Proto` are inbound headers; unless the
upstream proxy normalizes them, an attacker can request:

```
POST /api/auth/send-link
Host: evil.example
{"email": "victim@example.com"}
```

The victim then receives an email containing
`https://evil.example/api/auth/verify?token=…`. Clicking it leaks the
single-use token to the attacker, who can complete sign-in and own the
victim's session. The same primitive exists in `billing/checkout/route.ts`
(success/cancel URLs) and `billing/portal/route.ts` (return URL) — these
are lower impact because the user must already be authed and Stripe is the
intermediary, but they still let an attacker phish a logged-in user back to
a look-alike origin.

**Exploit scenario**

1. Attacker controls a domain that resolves to the prod IP (DNS rebinding,
   CDN bypass) or just sends a forged-Host request directly.
2. Attacker submits `email=victim@example.com` with `Host: evil.tld`.
3. Real email is delivered with attacker-controlled origin in the link.
4. Victim clicks → token sent to attacker's server → attacker replays it
   against the real origin within 15 min and gets a session cookie.

**Fix applied** — added `web/src/lib/public-url.ts` with `publicBaseUrl(req)`:

```ts
export function publicBaseUrl(req: NextRequest): string {
  const explicit = process.env.PUBLIC_BASE_URL ?? process.env.MAGIC_LINK_BASE_URL;
  if (explicit) return trimTrailingSlash(explicit);
  if (process.env.NODE_ENV === "production") {
    return CANONICAL_PROD_BASE_URL; // "https://scrolldownsports.dev"
  }
  // dev only — host-header fallback retained
  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
```

Used by:
- `web/src/app/api/auth/send-link/route.ts`
- `web/src/app/api/billing/checkout/route.ts`
- `web/src/app/api/billing/portal/route.ts`

In production with no `PUBLIC_BASE_URL` set, the canonical site URL is now
hardcoded — host header cannot influence the email link or the Stripe return
URL. Dev still uses host headers for `localhost:3001` ergonomics.

### H2 — AdSense client ID not URL-encoded  *(Acted)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

`AdSenseScript.tsx` interpolates `process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID`
into a query string with no encoding:

```tsx
src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
```

A misconfigured env value with `&` or `#` would corrupt the URL and (worst
case) graft additional query parameters onto the request. Not a remote
attacker primitive — the value is set by the deploy operator at build time
— but `encodeURIComponent` is one call, so it's fixed.

**Fix applied**:

```tsx
src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`}
```

### H3 — Reveal-sync PUT had no body-size limit and weak shape validation  *(Acted)*

**Severity**: Medium &nbsp;|&nbsp; **Confidence**: High

**Evidence (pre-fix)** — `sync/reveal/route.ts`:

```ts
let body: SyncBody;
try {
  body = (await req.json()) as SyncBody;
} catch { /* 400 */ }

if (!Array.isArray(body.revealedIds)
    || typeof body.snapshots !== "object"
    || body.snapshots === null) {
  return ... 400;
}

const existing = loadRecord(session.userId);
const merged = mergeRecord(existing, body);
saveRecord(session.userId, merged);
```

Issues:

1. **No body-size cap.** `req.json()` will buffer arbitrary payload sizes.
   An authenticated Pro user could send a multi-MB JSON to spend server
   memory and CPU on `Set` / `Map` ops before the eventual cap-to-500 trim.
2. **Element validation absent.** `revealedIds` is checked for `Array.isArray`
   only — entries can be strings, objects, or anything else; they get added
   to the `Set` and capped, surviving back to the next `GET` (and to other
   logged-in clients of the same user). `snapshots` values are blob-passed
   through.
3. **`snapshots` could be an array** (still passes `typeof === "object"`).
   `Object.entries` on an array gives numeric string keys, so this didn't
   break, but it's lax.

**Fix applied**:

- Hard cap of 64 KB on declared `Content-Length` and on the parsed body
  string. Returns 413.
- Reject `Array.isArray(body.snapshots)`.
- Filter `revealedIds` to finite integers only (drop, don't reject — this
  preserves forward/backward compatibility for clients carrying legacy
  string ids).
- Filter `snapshots` entries: integer key + minimal shape check (object
  with a string `snapshotAt` of bounded length). The merge logic only ever
  reads `snapshotAt`; full shape enforcement would just reject legitimate
  client data without reducing risk.

### H4 — Magic-link token not URL-encoded into link  *(Acted)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

`generateMagicToken()` returns `randomBytes(32).toString("hex")` so the
token is currently `[0-9a-f]{64}` and URL-safe. But the call site assumed
that property of an internal helper, which is brittle if the encoding ever
changes (e.g. base64url, which can include `-`/`_` — both URL-safe but the
discipline is worth keeping). One call: `encodeURIComponent(token)`.

### J1 — `?tier=pro&userId=*` URL override  *(Justified)*

**Severity**: Medium &nbsp;|&nbsp; **Confidence**: High

`sync/reveal/route.ts:18-25` allows `?tier=pro&userId=anything` to bypass
session verification when `allowDevTierUrlOverrides()` returns `true`.
That helper returns true when `process.env.NODE_ENV !== "production"` OR
`process.env.NEXT_PUBLIC_SCROLLDOWN_E2E === "1"`. The latter is checked
**at build time** because of the `NEXT_PUBLIC_` prefix, so a production
deploy is only exposed if its build was run with that env var set.

If exposed:
- Anyone can `GET /api/sync/reveal?tier=pro&userId=<some-id>` to read another
  user's revealed-game IDs (low-sensitivity data — game IDs the user has
  marked).
- Anyone can `PUT /api/sync/reveal?tier=pro&userId=<some-id>` to overwrite
  another user's reveal sync state.

**Why not act**: removing the override breaks the entire E2E suite, which
explicitly relies on it (`tests/freemium/tier-gating-suite.spec.ts`,
`tests/ads/ad-placements.spec.ts`). The route already has a comment naming
the constraint. The blocker is operational: a production deploy must
guarantee `NEXT_PUBLIC_SCROLLDOWN_E2E` is unset at build time. That is a
deploy-pipeline assertion, not a code change.

**How to apply**: deploy CI must reject builds where
`NEXT_PUBLIC_SCROLLDOWN_E2E === "1"` is exported in the prod build env.

### J2 — CSP `'unsafe-inline'` + broadened third-party set  *(Justified)*

**Severity**: Medium &nbsp;|&nbsp; **Confidence**: High

`script-src` retains `'unsafe-inline'` from before the diff and now adds
8 Google ad-network origins. `'unsafe-inline'` defeats CSP's main XSS
defense — any reflected/stored XSS sink anywhere in the React tree
becomes script-execution.

**Why not act**: removing `'unsafe-inline'` requires a nonce/`'strict-dynamic'`
strategy, which is non-trivial in Next.js App Router (the `<Script>` and the
JSON-LD `dangerouslySetInnerHTML` block in `layout.tsx` both rely on inline
script execution). That is a small project, not a one-line edit, and the
rest of this audit is single-file scope.

**How to apply (sketch)**:

1. Generate a per-request nonce in middleware and pass through a request
   header to RSC/Layout.
2. Replace `'unsafe-inline'` with `'nonce-<nonce>' 'strict-dynamic'`.
3. Audit each inline `<script>` site (layout.tsx JSON-LD, sw-register, the
   AdSense `<Script>` itself if Next emits it inline).

### J3 — File-store read–modify–write race  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

`saveAccounts` (`magic-link.ts`) and `saveRecord` (`sync/reveal/route.ts`)
both perform `loadStore()` → mutate → `writeFileSync`. Two concurrent
requests can lose one writer's update. Not a security bug — it's a data
durability bug. Logging in via two devices in the same second can lose one
account creation; two reveal-sync PUTs from two tabs can lose one tab's
data.

**Why not act**: a real fix needs an OS-level file lock or migration to
SQLite/Redis. Both are bigger than this pass. The corrupt-file quarantine
already in place (error-handling report §F1/§F2) bounds the worst case to
"last writer wins" rather than "store gets nuked."

**How to apply (sketch)**: introduce `proper-lockfile` or migrate the
account/sync stores to a sqlite-backed kv. Single-instance deploy makes
in-memory mutex an acceptable interim.

### J4 — Magic-link email HTML interpolates the link  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: Medium

`magic-link.ts:256-262` builds the HTML email with template strings:

```ts
`<p><a href="${link}" style="font-size:16px;font-weight:bold;">Sign in</a></p>`
```

After H1's fix, `link` is `${publicBaseUrl(req)}/api/auth/verify?token=…`
where:

- `publicBaseUrl(req)` is either an env-configured string, the hardcoded
  canonical URL, or in dev the host header.
- The token is URL-encoded hex.

There is no operator-attacker model where `link` contains `"`/`<`. If a
deploy ever sets `PUBLIC_BASE_URL` to a value with `"`, that is a
self-inflicted misconfig that breaks the email immediately and noisily.

**Why not act**: introducing an HTML escape helper for one anchor is more
ceremony than guard against any realistic attacker. Linked into the report
so a future reviewer can see the deliberate decision.

**How to apply if the threat model changes**: HTML-escape `link` before
interpolation if any attacker-controllable string is ever spliced into it.

### J5 — `findAccountByStripeCustomerId` is O(n)  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

Linear scan over every account on every Stripe webhook. At thousands of
accounts this is irrelevant; at tens of thousands the webhook adds latency
and forces Stripe retries on timeout. Not a security issue today.

**Why not act**: optimization, not security. Address when migrating off
the JSON file store.

### J6 — Subscription not downgraded on `unpaid`/`past_due`  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: Medium

`billing/webhook/route.ts` only downgrades on `customer.subscription.deleted`.
A subscription stuck in `past_due`/`unpaid` keeps Pro entitlement. Stripe
eventually transitions to `canceled` → `deleted`, but the gap (default 23
hours of dunning) is a free-Pro window. Not exploitable without payment-method
control.

**Why not act**: this is a billing-policy decision (do we cut off Pro mid-cycle
for a failed payment, or is grace period intentional?). Out of scope for a
security pass — needs product input.

### J7 — AdSense loader without SRI  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

`<Script ... src="…/adsbygoogle.js">` has `crossOrigin="anonymous"` but no
`integrity`. AdSense's `adsbygoogle.js` is a moving target — Google revs
the file frequently — so SRI would break ads on every Google deploy. This
is the standard published guidance for AdSense.

**Why not act**: SRI here would create a self-DoS on ads; supply-chain
risk lives with the AdSense provider, mitigated by the gate that prevents
the script loading for paid/admin users.

### J8 — `ads.txt` placeholder  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: High

`web/public/ads.txt` is two comment lines. Without a populated `ads.txt`,
buyers cannot verify our seller relationship and we are vulnerable to
domain-spoof ad fraud (someone else claims to be selling our inventory).
This is a publishing risk, not a webapp security risk.

**Why not act**: needs the AdSense publisher ID, which is captured during
account approval. Tracked in `docs/ADS_SETUP.md`; this is the right
pre-launch follow-up for the operator, not an in-code fix.

### J9 — Auth proxy whitelist allows `me/*` writes  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: Medium

`/api/auth/[...path]/route.ts:9-21` whitelists `me`, `me/email`,
`me/password`, `me/preferences`, `refresh`. The proxy injects the inbound
`Authorization` header but does not re-validate the token shape. The
backend at `sda.dock108.dev` is responsible for IDOR enforcement. For our
proxy, the only risk is rate-limit bypass — and the proxy already applies
its own per-IP limiter (8/min strict, 30/min standard).

**Why not act**: the proxy is already minimal and the whitelist is the
right hardening. Backend-side IDOR is out of scope for the web repo.

### J10 — `customer.subscription.created` keeps existing tier  *(Justified)*

**Severity**: Low &nbsp;|&nbsp; **Confidence**: Medium

The webhook handler for `created`/`updated` uses `account.tier` (current)
when calling `updateAccountTier`. The Pro upgrade itself happens in
`checkout.session.completed`. If a customer is created via the dashboard
or API outside the checkout flow, their tier won't auto-upgrade — but
that is an admin action, not a user-controllable one.

**Why not act**: the choice to make `checkout.session.completed` the only
path that grants Pro is intentional (it's the only event with proven
payment_status === "paid"). Conflating subscription lifecycle events with
entitlement is what creates Stripe webhook bugs in other shops.

---

## 4. Safe Hardening Implemented This Pass

| Change                                                                                                  | File(s)                                                                                                              |
|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Added `publicBaseUrl(req)` SSOT helper; production now ignores attacker-controlled `Host`/`X-Forwarded-*` | `web/src/lib/public-url.ts` *(new)*                                                                                  |
| Switched magic-link, Stripe checkout, Stripe portal to the hardened helper                              | `web/src/app/api/auth/send-link/route.ts`, `web/src/app/api/billing/checkout/route.ts`, `web/src/app/api/billing/portal/route.ts` |
| URL-encoded the magic-link token in the verify link                                                     | `web/src/app/api/auth/send-link/route.ts`                                                                            |
| URL-encoded the AdSense client id in the loader script src                                              | `web/src/components/ads/AdSenseScript.tsx`                                                                           |
| Added 64 KB body-size cap (Content-Length + post-parse) on Pro reveal-sync PUT                          | `web/src/app/api/sync/reveal/route.ts`                                                                               |
| Tightened reveal-sync body validation: integer-only ids, snapshot shape check, reject array `snapshots`  | `web/src/app/api/sync/reveal/route.ts`                                                                               |

All changes are behavior-preserving for legitimate clients. No new env vars
are required; deploys may set `PUBLIC_BASE_URL` to make the production
canonical URL configurable, but the default is the hardcoded
`https://scrolldownsports.dev`.

---

## 5. Remediation Roadmap (in priority order)

1. **CSP nonce migration (J2).** Removes `'unsafe-inline'` from `script-src`
   and is the single most valuable hardening still pending. Estimated effort:
   1–2 days (middleware nonce, layout/script audit, test pass on AdSense and
   Plausible). Affects: every page render.

2. **Production build guard against `NEXT_PUBLIC_SCROLLDOWN_E2E=1` (J1).**
   CI pipeline change, not a code change. Add a pre-build assertion in
   the deploy workflow:
   `if [ "$NODE_ENV" = "production" ] && [ "$NEXT_PUBLIC_SCROLLDOWN_E2E" = "1" ]; then exit 1; fi`.
   Estimated effort: 30 minutes.

3. **Account / sync store concurrency (J3).** Migrate to a sqlite-backed
   kv (matches existing single-instance Hetzner deploy). Estimated effort:
   1 day. Fixes data-loss race + J5 lookup performance simultaneously.

4. **Populate `web/public/ads.txt` (J8).** One-line edit once AdSense
   publisher ID is confirmed. Required before AdSense traffic monetizes
   reliably.

5. **Subscription downgrade policy (J6).** Product decision: do we cut
   off Pro on `past_due`, or treat dunning as grace? Either way, document
   the decision and align webhook handlers.

---

## 6. Escalations

None. Every finding either has an applied fix or a written justification
with a concrete next action.

---

## Verification Commands

```bash
cd web
npx tsc --noEmit          # exit 0
npm run lint              # clean
npm run test:unit         # 9/9 passed
```

E2E was not re-run in this pass; the changed routes have no behavioral
differences for legitimate clients. The Playwright ad-placement and
tier-gating suites continue to drive the same code paths.

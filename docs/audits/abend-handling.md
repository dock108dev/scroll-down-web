# Abend Handling Audit

**Date**: 2026-04-18  
**Branch**: aidlc_1  
**Auditor**: Claude Sonnet 4.6  
**Scope**: `web/src/` — all lib, stores, hooks, realtime, and app/api files

---

## Executive Summary

The codebase has a mostly sound error-handling philosophy: realtime transport fails over gracefully, stale cache avoids cold blank screens, and analytics are best-effort. However, several blind spots create real reliability and observability risk:

- **Four Zustand custom storage adapters** (`pinned-games`, `reveal`, `reading-position`, `section-layout`) called `JSON.parse` without try/catch. Corrupt `localStorage` data would throw an unhandled exception during hydration, potentially crashing the app before the first render. **Fixed.**
- **SSE proxy route** (`/api/realtime/sse/route.ts`) had no try/catch around the upstream `fetch()`. A DNS failure or connection refusal would throw an uncaught exception in a Next.js Route Handler, producing a framework-level 500 instead of a clean 502. **Fixed.**
- **`useFairBetLive` game discovery** swallowed errors and returned `[]` without setting `error` state, so users silently saw "No live games" during backend failures. **Fixed.**
- **Realtime transport** swallowed handler exceptions and malformed message parse errors with no log. **Fixed** — added `console.error` to make these visible.
- **`refreshMe`** in `auth.ts` silently drops non-401 network/server errors, leaving the user in a limbo logged-in state with null `email`/`userId`. **Partially fixed** — added `console.error`; full fix requires a UI-level error signal (tracked below).
- **`preferences-sync` `fetchPreferences`** had no try/catch around the `fetch()` call itself. Network errors propagated to an outer catch that swallowed them completely. **Fixed.**

---

## Findings

### Severity Key
- **Note**: Acceptable — intentional design, no action needed
- **Low**: Minor gap, easy to confuse but low blast radius
- **Medium**: Silent failure that can confuse operators or mislead users
- **High**: Silent failure with data integrity or user-facing reliability impact
- **Critical**: Potential for unhandled exception / app crash

---

### A. localStorage / Store Hydration

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| A1 | `stores/pinned-games.ts` | 76–98 | `JSON.parse` without try/catch in custom `getItem`; `setItem` without try/catch | **Critical** | **Fixed** |
| A2 | `stores/reveal.ts` | 113–157 | Same pattern; this store holds the product's core reveal invariant | **Critical** | **Fixed** |
| A3 | `stores/reading-position.ts` | 46–75 | Same pattern | **High** | **Fixed** |
| A4 | `stores/section-layout.ts` | 66–96 | Same pattern | **High** | **Fixed** |

**What was missing**: All four stores used custom Zustand persist storage adapters that called `localStorage.getItem()` + `JSON.parse()` with no error handling. A corrupt entry (truncated write from a prior quota error, browser migration, or manual edit) would throw an unhandled exception during Zustand hydration — before any React error boundary could catch it.

**Fix applied**: Wrapped `getItem` in try/catch that calls `localStorage.removeItem(name)` and returns `null` (treat as cache miss). Wrapped `setItem` in try/catch that silently drops quota/permission errors (data won't persist, but the app keeps running).

---

### B. SSE Proxy Route

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| B1 | `app/api/realtime/sse/route.ts` | 12–18 | `fetch()` with no try/catch — DNS/connection failure throws unhandled | **High** | **Fixed** |

**Fix applied**: Wrapped upstream `fetch()` in try/catch; returns a clean 502 with a `console.error` log on failure.

---

### C. Auth Store

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| C1 | `stores/auth.ts` | 100–104, 125–129, 264–268 | Post-login `refreshMe()` failure caught and downgraded to `trackEvent` only — user has valid token but null email/userId | **High** | Tracked (see below) |
| C2 | `stores/auth.ts` | 161–166 | `refreshMe` swallows non-401 errors (500, network) — no log | **Medium** | **Fixed** — added `console.error` |
| C3 | `stores/auth.ts` | 184–192 | `refreshToken` swallows non-404 errors with only `trackEvent` — expired token not cleared, delayed cascade | **Medium** | Note — `trackEvent` provides some signal; 401 from token refresh is handled upstream via per-request 401 → logout |

**C1 detail**: When `refreshMe()` fails after a successful login/signup/magic-link, the user lands with a valid JWT but `email` and `userId` are `null`. Any UI rendering these (settings drawer, admin gate) shows empty/incorrect state. The catch block downgrades to an analytics event (`profile_hydrate_error`) rather than setting UI error state or retrying.

**Recommended follow-up (C1)**: Surface a non-fatal toast: "Signed in — couldn't load your profile. Please refresh." Alternatively, retry `refreshMe()` once after 2 seconds before silently falling through.

---

### D. Preferences Sync

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| D1 | `lib/preferences-sync.ts` | 56 | `fetch()` inside `fetchPreferences` had no try/catch — network errors propagated to outer catch that swallowed them with no log | **High** | **Fixed** |
| D2 | `lib/preferences-sync.ts` | 254–258 | Outer catch in `pullAndStartSync` swallows all errors from `fetchPreferences` — comment claimed it was logged inside, but network errors were not | **Medium** | Fixed via D1 |
| D3 | `lib/preferences-sync.ts` | 61–65 | `console.warn` for HTTP failure, deduplicated to once per login — ongoing failures invisible | **Medium** | Note — acceptable dedup, but consider resetting the flag on successful pull |
| D4 | `lib/preferences-sync.ts` | 85–88 | `console.warn` for push failure, suppressed after first occurrence | **Medium** | Note — circuit breaker (`MAX_BACKOFF_FAILURES`) stops scheduling after 3 failures; acceptable pattern |
| D5 | `lib/preferences-sync.ts` | 283–297 | `flushPreferences` (on-unload) drops returned Promise with no `.catch()` — keepalive fetch rejection is unhandled | **Low** | Note — `keepalive: true` is best-effort by spec; unhandled rejection on unload is low-risk |
| D6 | `lib/preferences-sync.ts` | 202–207 | Debounced push `.catch(() => {})` — after first logged failure, all subsequent push failures are completely silent | **Medium** | Note — circuit breaker bounds runaway; acceptable for now |

---

### E. FairBet Live Odds

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| E1 | `hooks/useFairBetLive.ts` | 75–86 | `discoverGames` catch returned `[]` without setting `error` state — users saw "No live games" during backend errors | **High** | **Fixed** |
| E2 | `hooks/useFairBetOdds.ts` | 328–331 | Background silent-refresh failure `.catch(() => {})` — stale cache shown indefinitely | **Medium** | Note — acceptable for silent background refresh; stale banner covers this |
| E3 | `hooks/useFairBetOdds.ts` | 364–367 | Realtime-triggered refresh failure swallowed — `.catch(clearCounter)` | **Medium** | Note — prevents retry storms; stale banner covers this |
| E4 | `hooks/useFairBetOdds.ts` | 373–379 | Visibility-triggered refresh failure `.catch(() => {})` | **Medium** | Note — same as E2 |

---

### F. Realtime Transport

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| F1 | `realtime/transport.ts` | 205–212 | WS `onmessage` parse/dispatch errors swallowed with no log | **Medium** | **Fixed** — added `console.error` |
| F2 | `realtime/transport.ts` | 292–298 | SSE `onmessage` parse/dispatch errors swallowed with no log | **Medium** | **Fixed** — added `console.error` |
| F3 | `realtime/transport.ts` | 346–354 | `dispatch()` handler exceptions swallowed per-handler with no log | **High** | **Fixed** — added `console.error` |
| F4 | `realtime/transport.ts` | 174–179 | WS constructor catch → `onWsFail()` — intentional fallback, error details lost | **Low** | Note — fallback is correct; error message would help diagnosis |
| F5 | `realtime/transport.ts` | 279–283 | SSE constructor catch → offline + reconnect — same as F4 | **Low** | Note |

**F3 detail**: `dispatch()` iterates all registered handlers in a try/catch per handler. A runtime error in the `dispatcher.ts` `handleEvent` function (e.g., unexpected data shape during `applyGamePatch`) would be silently swallowed, leaving game state partially or incorrectly updated. The added `console.error` gives visibility without crashing the transport.

---

### G. API Layer

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| G1 | `lib/api-server.ts` | 17–27 | Upstream 401/403 mapped to 502 with no server-side log — API key misconfiguration indistinguishable from outage | **Medium** | Note |
| G2 | `lib/api.ts` | 82–85 | Silent logout on 401, then throws generic error — user sees "trouble loading data" not "session expired" | **Medium** | Note |
| G3 | `app/api/health/route.ts` | 9–14 | All errors (401, 500, timeout, DNS) treated as "degraded" — API key misconfiguration masked as outage | **Medium** | Note |
| G4 | `app/api/auth/[...path]/route.ts` | 120–126 | Auth proxy catch returns 502 with no server-side log | **Low** | Note |

---

### H. Stale Cache

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| H1 | `lib/stale-cache.ts` | 14–23 | `JSON.parse` catch → `return null` — unmonitored cache corruption | **Low** | Note — correct behavior; no observability into frequency |
| H2 | `lib/stale-cache.ts` | 27–35 | `localStorage.setItem` catch → silent — quota errors kill stale fallback with no signal | **Medium** | Note — acceptable; could add a sampled `console.warn` |

---

### I. Analytics

| ID | File | Lines | Pattern | Severity | Status |
|----|------|--------|---------|----------|--------|
| I1 | `lib/analytics.ts` | 17–37 | Outer try/catch + inner `.catch(() => {})` swallow all analytics errors | **Note** | Intentional — analytics must never break the app |

---

## Summary by Disposition

### Fixed In This Audit

| Finding | Description |
|---------|-------------|
| A1–A4 | Custom store localStorage adapters wrapped with try/catch + corrupt-key eviction |
| B1 | SSE proxy upstream fetch wrapped in try/catch |
| C2 | `refreshMe` non-401 errors now log via `console.error` |
| D1 | `fetchPreferences` network errors now caught and logged |
| E1 | `discoverGames` now sets `error` state on failure |
| F1–F3 | Realtime WS/SSE parse errors and handler exceptions now log via `console.error` |

### Recommended Follow-Up (Not Fixed — Requires Product/UX Decision)

| Priority | Finding | Recommendation |
|----------|---------|----------------|
| High | C1 — post-login `refreshMe` failure | Add a retry (once, after 2s) before falling through. If still fails, show a non-fatal toast: "Signed in — couldn't load your profile. Please refresh." |
| Medium | G1/G3 — 401/403 from backend mapped to 502 | Add a server-side `console.error` in the proxy that tags the response as an auth failure vs. generic outage. The client behavior (502) stays the same. |
| Medium | G2 — silent logout on 401 | Improve the error message surfaced to the user: "Your session has expired. Please sign in again." |
| Medium | H2 — stale cache quota errors | Add a sampled `console.warn` (once per session) when `writeCache` hits a quota error, so ops can detect storage pressure. |
| Low | F4/F5 — WS/SSE constructor catch | Log the caught error (`console.error`) before calling `onWsFail()` / going offline. |
| Low | D5 — `flushPreferences` on-unload | Add `.catch(() => {})` explicitly on the returned Promise to suppress the unhandled rejection warning; document that this is intentional best-effort. |

### Acceptable — No Action Needed

| Finding | Rationale |
|---------|-----------|
| I1 — analytics swallowed | Intentional: analytics errors must never break the app |
| D4 — push failure after circuit breaker | Acceptable: circuit breaker bounds runaway, `trackEvent` provides some signal |
| H1 — stale cache `JSON.parse` catch | Correct: treat corrupt cache as miss, not a crash |
| C3 — `refreshToken` non-404 errors tracked | `trackEvent` provides signal; upstream per-request 401 handling provides cleanup |
| E2–E4 — background/visibility refresh failures | Stale data banner covers the user-visible gap; retry on next poll cycle |

---

## Files Changed

```
web/src/app/api/realtime/sse/route.ts   — try/catch around upstream fetch
web/src/stores/pinned-games.ts          — try/catch in custom storage adapter
web/src/stores/reveal.ts                — try/catch in custom storage adapter
web/src/stores/reading-position.ts      — try/catch in custom storage adapter
web/src/stores/section-layout.ts        — try/catch in custom storage adapter
web/src/hooks/useFairBetLive.ts         — discoverGames sets error state on failure
web/src/realtime/transport.ts           — console.error on WS/SSE parse errors and handler throws
web/src/stores/auth.ts                  — console.error on non-401 refreshMe failure
web/src/lib/preferences-sync.ts        — try/catch around fetchPreferences network call
```

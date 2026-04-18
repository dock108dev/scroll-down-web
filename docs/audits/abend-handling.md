# Abend Handling Audit

**Date:** 2026-04-18  
**Branch:** aidlc_1  
**Scope:** `web/src/` — all TypeScript/TSX source files

---

## Executive Summary

The codebase has a generally sound error-handling philosophy: API proxy errors surface cleanly, realtime transport degrades gracefully, and preference sync is intentionally non-fatal. However, three **high-severity data-integrity blind spots** were found in the file-based auth/sync layer: `loadAccounts()` and `loadStore()` both swallow filesystem/JSON errors silently and return empty state — meaning a corrupted JSON file causes **permanent silent data loss** (accounts wiped, reveal sync wiped) with no operator log. A related HIGH finding is the missing startup warning when `DATA_DIR` is not set in `sync/reveal/route.ts`. These were fixed in-place.

Four additional observability fixes were applied (SSE/WS error logging, preference-sync error-gate reset, localStorage guard in `RevealOnboarding`). Twelve further LOW–MEDIUM findings are annotated with remediation notes.

**Fixed in this audit:** 6 issues  
**Noted as acceptable:** 8 issues  
**Require future attention:** 6 issues

---

## Findings

### HIGH — Data-Integrity / Silent Data Loss

| # | File | Lines | Pattern | Risk |
|---|------|-------|---------|------|
| H1 | `lib/magic-link.ts` | 127–128 | `loadAccounts()` bare `catch` returns empty `Map` — silent data loss on corrupt `sd-accounts.json` | **HIGH** |
| H2 | `app/api/sync/reveal/route.ts` | 51–52 | `loadStore()` bare `catch` returns `{}` — silent data loss on corrupt `sd-reveal-sync.json` | **HIGH** |
| H3 | `app/api/sync/reveal/route.ts` | 43, 57 | `DATA_DIR ?? "/tmp"` used with no warning — reveal-sync data stored in `/tmp` in production silently | **HIGH** |
| H4 | `lib/api-server.ts` | 5 | `API_KEY` defaults to `""` with no startup warning — 401s cascade to 502s at runtime only | **HIGH** |

**H1 detail:** `loadAccounts()` returns `new Map()` on any `JSON.parse` or filesystem error. The next `findOrCreateAccount()` call overwrites the corrupted file with an empty set, making data loss permanent. Affects user tier, Stripe customer ID, subscription status.  
**→ Fixed:** added `console.error` before returning empty Map.

**H2 detail:** Same pattern in the reveal-sync file store. A partial write (power loss, disk full) corrupts the JSON; next GET/PUT silently resets all users' cross-device reveal state to empty.  
**→ Fixed:** added `console.error` before returning `{}`.

**H3 detail:** `syncPath()` in `app/api/sync/reveal/route.ts` uses `process.env.DATA_DIR ?? "/tmp"` with no production warning. `magic-link.ts`'s `dataDir()` already has the `NODE_ENV === "production"` guard; the sync route did not.  
**→ Fixed:** added equivalent `NODE_ENV` guard to `syncPath()`.

**H4 detail:** Downstream effect is a cascade of 502 responses (since `ApiError.isUpstreamGatewayError` maps 401 → 502). Visible to users but invisible in startup logs.  
**→ Not fixed here** — requires env validation at startup; tracked in remediation plan.

---

### MEDIUM — Observability / Silent Failure Paths

| # | File | Lines | Pattern | Risk |
|---|------|-------|---------|------|
| M1 | `lib/reveal-sync.ts` | 40–47 | `fetchRemoteState()` bare `catch` returns `null` — no log | MEDIUM |
| M2 | `lib/reveal-sync.ts` | 135, 138 | `pullAndMerge().catch(() => {})` double-silences M1 | MEDIUM |
| M3 | `app/api/auth/send-link/route.ts` | 64–69 | Email delivery failure logged then returns 200 — token stored but never delivered, no retry | MEDIUM (intentional) |
| M4 | `app/api/sync/reveal/route.ts` | 56–59 | `saveStore()` — `writeFileSync` uncaught; throws 500 with no structured log | MEDIUM |
| M5 | `app/analytics/(mlb)/models/page.tsx` | 135–148 | `catch { /* ignore */ }` on admin cancel/activate — no UI feedback | MEDIUM |
| M6 | `app/analytics/(mlb)/batch/page.tsx` | 134–150 | `catch { /* ignore */ }` on job detail/outcomes — blank UI, no error | MEDIUM |

**M1/M2:** When cross-device reveal sync fails (network, 401, malformed JSON), both the inner fetch and the outer callers swallow silently. Pro users lose sync with no indication.  
**→ Fixed:** added `console.warn` in `fetchRemoteState` catch. Outer `.catch(() => {})` at lines 135/138 are now harmless redundancy (internal warn fires first).

**M3:** Intentional anti-enumeration design — documented with comment. `console.error` already fires. The magic token is stored and will expire naturally (15 min). No retry/dead-letter queue exists.  
**→ Acceptable.** Future: add metric counter for Resend failures in `/api/health`.

**M4:** `saveStore()` calls `writeFileSync` with no try/catch — a full disk throws unhandled into Next.js.  
**→ Not fixed here.** Tracked in remediation plan.

**M5/M6:** Admin-only surfaces. Failed operations show no error in the UI.  
**→ Not fixed here.** Tracked in remediation plan.

---

### LOW — Acceptable Patterns with Minor Observability Gaps

| # | File | Lines | Pattern | Severity |
|---|------|-------|---------|----------|
| L1 | `realtime/transport.ts` | 220–222 | `ws.onerror` no-op — WS error type never logged | LOW |
| L2 | `realtime/transport.ts` | 301–306 | `sse.onerror` — no log before reconnect | LOW |
| L3 | `lib/stale-cache.ts` | 20–23 | JSON.parse failure returns `null` silently | LOW |
| L4 | `hooks/useFairBetOdds.ts` | 181–204 | Two `catch { /* ignore */ }` on localStorage filter read/write | LOW |
| L5 | `hooks/useFairBetOdds.ts` | 270–280 | `Promise.allSettled` page failures set `stale: true` but log nothing | LOW |
| L6 | `stores/auth.ts` | 186–194 | `refreshToken` non-404 error tracked but token left stale | LOW |
| L7 | `stores/auth.ts` | 100–103, 267–269 | `profile_hydrate_error` tracks event, drops error object | LOW |
| L8 | `lib/preferences-sync.ts` | 70–73 | `fetchHasLoggedError` never resets — failures silent after recovery | LOW |
| L9 | `components/home/RevealOnboarding.tsx` | 12–13, 38 | Raw `localStorage` access — throws `DOMException` in private browsing | LOW |
| L10 | `lib/reveal-sync.ts` | 163–169 | `flushRevealSync` calls `pushLocalState` directly — errors propagate uncaught | LOW |
| L11 | `lib/reveal-idb.ts` | 271–276 | Migration parse failure silent — localStorage removed even on error | LOW |
| L12 | `stores/session.ts` | 47–49 | Network error on session check silently downgrades to anonymous | LOW |

**L1:** WebSocket `onerror` always precedes `onclose`; `onclose` handles the failure. Standard WS pattern, but error type unobservable.  
**→ Fixed:** added `console.warn` in `ws.onerror`.

**L2:** SSE `onerror` reconnect loop runs with no log.  
**→ Fixed:** added `console.warn` in `sse.onerror`.

**L3:** Corrupt localStorage cache treated as miss with no log. Combined with `writeCache` logging quota errors, cache failures are discoverable for writes but not reads.  
**→ Acceptable** (cache miss is safe; adding a warn risks noise on malformed old entries).

**L4:** Filter persistence failures are completely silent. Corrupt filter data silently resets to defaults.  
**→ Acceptable** (non-critical UI preference; silent reset is fine UX).

**L5:** FairBet page failures set `stale: true` (user-visible via stale banner) but log nothing about which offsets failed.  
**→ Tracked in remediation plan** for future observability.

**L6:** On non-404 `refreshToken` failure, token stays stale in state. Events are tracked but no corrective action taken.  
**→ Tracked in remediation plan.**

**L7:** `profile_hydrate_error` drops the error object — analytics event has no detail if `refreshMe` throws unexpectedly.  
**→ Acceptable** for now; analytic event at least shows occurrence rate.

**L8:** `fetchHasLoggedError` gate never resets. If preferences fail, recover, then fail again hours later, the second failure window is completely invisible.  
**→ Fixed:** reset `fetchHasLoggedError = false` before successful `res.json()` return.

**L9:** `hasSeenOnboarding()` calls `localStorage.getItem` without try/catch. Firefox private browsing throws `DOMException: Access is denied` and crashes the component.  
**→ Fixed:** wrapped both read and write in try/catch.

**L10:** `flushRevealSync()` (called on tab close) calls `pushLocalState()` directly with no catch. If the push throws, the unhandled promise rejection is reported to the browser console.  
**→ Acceptable** (tab-close path; errors there are benign and the local IDB is preserved).

**L11:** IDB migration parse failure silently removes the localStorage entry — prior reveal state lost with no log.  
**→ Tracked in remediation plan.**

**L12:** Any network error during session check downgrades to anonymous/free with no log. A transient blip temporarily revokes Pro features.  
**→ Acceptable** (retry on next navigation; no durable state change).

---

### NOTE — Acceptable by Design

| # | File | Pattern | Rationale |
|---|------|---------|-----------|
| N1 | `lib/analytics.ts` | All errors swallowed | Analytics must never break app stability |
| N2 | `lib/api-server.ts:fixMojibake` | Returns original on decode failure | Defensive; mojibake preserved vs. crash |
| N3 | `components/game/GameStorySection.tsx` | `.catch(() => {})` on AI story + vote | Non-critical AI feature; vote loss acceptable |
| N4 | `lib/preferences-sync.ts` push circuit | First failure logged; subsequent suppressed | 3-failure threshold + 5-min auto-reset is correct |
| N5 | `realtime/transport.ts` dispatch handler | `catch(err)` logs and continues | Correct defensive isolation |
| N6 | `app/api/auth/send-link/route.ts` 200 on parse fail | Anti-enumeration design | Documented, intentional |
| N7 | `stores/auth.ts` authFetch `.catch()` on body parse | Generic message fallback | 502 body may not be JSON |
| N8 | `lib/reveal-sync.ts` pushLocalState silent catch | Comment documents intent | Local IDB preserved; retries on interval |

---

## Changes Applied In This Audit

### 1. `lib/magic-link.ts` — `loadAccounts()` error logged
`catch { return new Map(); }` → `catch (err) { console.error(..., err); return new Map(); }`

### 2. `app/api/sync/reveal/route.ts` — `loadStore()` error logged + DATA_DIR warning
`catch { return {}; }` → `catch (err) { console.error(..., err); return {}; }`  
Added `NODE_ENV === "production"` guard to `syncPath()` matching `magic-link.ts`'s pattern.

### 3. `lib/reveal-sync.ts` — `fetchRemoteState()` logs on catch
`catch { return null; }` → `catch (err) { console.warn(`${TAG} fetchRemoteState network error (non-fatal):`, err); return null; }`

### 4. `realtime/transport.ts` — ws.onerror and sse.onerror log
Added `console.warn("[realtime/ws] onerror:", e)` and `console.warn("[realtime/sse] onerror — scheduling reconnect")`.

### 5. `lib/preferences-sync.ts` — reset `fetchHasLoggedError` on success
Added `fetchHasLoggedError = false;` before `return res.json()` so recovery re-enables the error gate.

### 6. `components/home/RevealOnboarding.tsx` — localStorage guarded
Wrapped `hasSeenOnboarding()` read and dismiss `setItem` in try/catch.

---

## Remediation Plan

### Immediate (before next production deploy)

1. **Validate `API_KEY` at startup** (`lib/api-server.ts`):
   ```ts
   if (!API_KEY && process.env.NODE_ENV === "production") {
     console.error("[api-server] FATAL: No API key env var set. All backend requests will fail.");
   }
   ```

2. **Wrap `saveStore()` / `saveAccounts()` writes** — `writeFileSync` on a full disk throws unhandled into the Next.js route handler. Add try/catch with `console.error` and rethrow so the handler returns 500 with a structured message.

### Short-term (next sprint)

3. **Admin analytics pages** — replace `catch { /* ignore */ }` in `models/page.tsx` and `batch/page.tsx` with error state (`setError(String(err))`).

4. **FairBet page failure logging** — in `useFairBetOdds.ts` `Promise.allSettled` loop, log which page offsets failed so operators can correlate stale-banner reports with backend errors.

5. **`refreshToken` stale-token handling** — on non-404 error, schedule a re-auth or at minimum clear the token so subsequent requests fail fast rather than silently using a stale credential.

### Future / Nice-to-Have

6. **Email delivery metric** — count Resend failures in memory and expose via `/api/health` so email degradation is surfaced in monitoring.

7. **`reveal-idb.ts` migration logging** — add `console.warn` on parse failure; consider deferring localStorage removal until IDB write succeeds.

8. **Structured server logging** — replace ad-hoc `console.error/warn` in server routes with a JSON-line logger for production log aggregator compatibility.

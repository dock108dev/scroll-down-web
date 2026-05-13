# Error Handling & Suppression Audit

> **Pass-5 (2026-05-13)** — observability sweep of the post-Phase-4 working
> tree (BFF proxy routes, hook fetches, SSR home/sitemap, browser API
> wrappers). The previous passes tightened the loud silent-swallow cases;
> this pass focuses on the remaining quietly-degraded paths where prod
> *recovers* gracefully but the operator never sees the underlying failure.
> Eight files changed — see **## Changes made (Pass-5)** below;
> per-item rationale lives under **§I — Pass-5 findings (observability
> diff)**.
>
> **Pass-4 (2026-05-09)** — incremental sweep of the new dev-only Catchup
> Lab page (`web/src/app/dev/catchup-lab/page.tsx`) added on top of the
> Pass-3 working tree. Two silent fetch swallows tightened; everything
> else inherited from Pass-3 still applies. Pass-4 changes are summarized
> below under **## Changes made (Pass-4)**; per-item rationale lives
> under **§H — Pass-4 findings (dev-tool diff)**.
>
> **Pass-3 (2026-05-09)** — narrow follow-up on the in-flight catchup-card
> diff (rundown profile, leverage band, narration-panel rework, extra-trail
> system). Pass-1 / Pass-2 (2026-04-28) covered the broader tree and remain
> below in full. Pass-3 changes are summarized under
> **## Changes made (Pass-3)**; per-item rationale lives under
> **§G — Pass-3 findings (catchup diff)** further down.

---

## Changes made (Pass-5)

Working-tree edits on top of Pass-4. Scope: the changed files in the
current diff (post-Phase-4 swap) — BFF proxy routes, browser fetch
wrappers, the homepage SSR pass, and the SW-cleanup bootstrap. Theme:
each of these paths *recovers* from upstream failure correctly, but every
one was failing silently in the operator log layer. Tightened to log
with enough context to diagnose without changing user-facing posture.

| File | What changed | Disposition |
|------|--------------|-------------|
| `web/src/app/api/games/[gameId]/cards/route.ts` (catch ~line 55) | Split the catch by error type. Non-`ApiError` (i.e. a code bug inside the proxy/cache pipeline, not an upstream issue) now logs to `console.error` before falling through to 500. Previously any throw became an anonymous 500 with no log. | **Acted (tighten)** — §I1 |
| `web/src/app/api/games/[gameId]/summary/route.ts` (catch ~line 46) | Same split — `ApiError` keeps its translated status; unexpected throws are logged. | **Acted (tighten)** — §I1 |
| `web/src/app/api/games/recent/route.ts` (catch ~line 36) | Same split — `ApiError` keeps its translated status; unexpected throws are logged. | **Acted (tighten)** — §I1 |
| `web/src/lib/api.ts` (catch ~line 47) | The fetch wrapper rewrites every network/abort error into a generic user-facing string, dropping the original. Added `{ cause: err }` to both throws so devtools, error-boundary breadcrumbs, and any future log sink see the underlying error. No user-facing copy change. | **Acted (tighten)** — §I2 |
| `web/src/lib/scroll-down-mlb-api.ts` (catch ~line 68) | Same `cause` propagation on the typed `ScrollDownMlbApiError` wrap. Also expanded the inline justification on the inner error-body `try/catch` (line ~56) — the catch is correct (the status is the signal, not the body) but it was bare `// ignore`. | **Acted (tighten + justify)** — §I2, §I3 |
| `web/src/app/layout.tsx` (inline SW-cleanup script, ~line 100) | The localhost-only SW unregister + cache cleanup had `.catch(function () {})`. Replaced with `console.warn` so a developer chasing a stuck SW sees a signal. Production path (the `register('/sw.js')` branch) already logged. | **Acted (tighten)** — §I4 |
| `web/src/lib/api-server.ts` (`cachedApiFetch` stale fallback, ~line 184) | When an upstream failure is masked by serving a stale cached response, we now `console.warn` with the cache key, age, and triggering error. The user-facing posture is unchanged (200 from cache) but a sustained outage that's silently degrading freshness now shows up in the logs. | **Acted (tighten)** — §I6 |
| `web/src/hooks/useCatchupCards.ts` (poll catch ~line 82) | Pre-existing rationale ("Polling failures are non-fatal — keep the current deck visible") is correct; expanded to cite the report section and explain why initial/refresh failures *do* surface (the explicit retry CTA depends on it). | **Acted (justify)** — §I5 |
| `web/src/app/sitemap.ts` (catch ~line 50) | The empty catch kept the sitemap valid on upstream failure but never told the operator anything was wrong — a prolonged outage was silently shrinking our index surface. Added a `console.warn` with the underlying error. | **Acted (tighten)** — §I7 |
| `web/src/app/page.tsx` (catch ~line 22) | Same fix on the SSR homepage path: empty games render is fine UX, but log so a sustained backend outage doesn't pass unnoticed on every render. | **Acted (tighten)** — §I7 |

No behavior change end-users will observe: every existing recovery path
still produces the same response code, copy, and cache headers. The
delta is that every "we gracefully degraded" branch now writes one log
line so the next incident is diagnosable in seconds, not hours.

Verification: `npx vitest run` — 206/206 tests pass. `npx tsc --noEmit`
clean on every touched file (the one pre-existing error in
`tests/helpers.ts` for `monocart-reporter` is unrelated to this diff).
`npx eslint` clean on every touched file.

### Pass-5 counts by severity

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 0 | — |
| High     | 0 | — |
| Medium   | 3 | Acted (3) — §I1, §I6, §I7 |
| Low      | 3 | Acted (3) — §I2, §I4, §I7 |
| Note     | 2 | Acted (justify) (2) — §I3, §I5 |

### Pass-5 inventory of suppressions in the diff

Diff-resident suppressions inspected and **left unchanged** (already at
the right posture):

- `web/src/lib/api-server.ts:96-98` — `fixMojibake` falls back to the
  original string when UTF-8 round-trip fails. Correct: any one of a
  thousand harmless non-mojibake strings will trip the heuristic; the
  fallback is the safe answer. Pure transform, no security or data
  integrity surface.
- `web/src/lib/scroll-down-mlb-api.ts:100-103, 121-126` — 404 → `null`
  and 409 → `null` on the typed API wrapper. These are documented
  contract behaviors ("no deck yet", "reveal not available"), not
  suppressions; the renderers explicitly branch on the `null`.
- `web/src/components/catchup/FinalReveal.tsx:57-60` — surfaces the
  caught error into component state for in-pane rendering. Correct
  posture; not silenced.
- `web/src/hooks/useGamesList.ts:41-43, 67` — same pattern as
  `useCatchupCards`: foreground failures surface to `error`, background
  poll catches are intentionally swallowed (re-pinging is the recovery).
  Justified pre-existing; no change.
- `web/src/components/layout/DegradedBanner.tsx:41-44` — health-ping
  catch increments the fail counter without logging. Correct: the
  *banner state* is the operator surface here, and Pass-1/2 already
  established this. A log per ping during an outage would be pure noise.
- `web/src/components/layout/BetaBanner.tsx:16-21, 37-42` and
  `web/src/components/layout/PWAInstallPrompt.tsx:17-22, 25-31, 35-39` —
  `localStorage` access wrapped in `try/catch` returning safe defaults.
  Correct posture for Safari Private mode / storage-disabled browsers;
  no observability value in logging a per-render fallback that the user
  can't act on.
- `web/src/components/catchup/BaseballLightField.tsx:1276-1295` —
  already loud-in-dev, silent-in-prod with a documented justification.
  No change.

### Posture verdict for Pass-5

**Acceptable, and improved.** Every recovery path in the changed-files
set now produces an operator-visible signal when it triggers. No code
behavior change for the end user; no copy change in the BFF responses;
no new failure modes introduced. The Pass-4 verdict ("Acceptable")
stands and is strengthened.

---

## §I — Pass-5 findings (observability diff)

### I1 — BFF proxy routes silently 500'd on non-ApiError throws

- **Locations**:
  - `web/src/app/api/games/[gameId]/cards/route.ts:55-61`
  - `web/src/app/api/games/[gameId]/summary/route.ts:46-58`
  - `web/src/app/api/games/recent/route.ts:36-39`
- **Risk lens**: Observability / reliability
- **Severity**: Medium — these are the three live BFF endpoints. A code
  bug inside `cachedApiFetch`, the JSON normalizer, the cache map, or
  any future post-processing would have thrown a non-`ApiError`, hit the
  generic catch, and returned `{ error: "Failed to fetch …" }` with
  status 500 to the client and **nothing at all** in the server log.
- **Disposition**: **Acted (tighten)**. The catch is now structured as
  "translate `ApiError`, log everything else." The end-user 500 is
  preserved (cheap to do, no leak), but the operator now sees the
  underlying error.

```ts
} catch (err) {
  if (err instanceof ApiError && err.status === 404) {
    return NextResponse.json({ error: "No deck for this game yet." }, { status: 404 });
  }
  if (err instanceof ApiError) {
    return NextResponse.json({ error: "Failed to fetch deck" }, { status: err.proxyStatus });
  }
  console.error("[api/games/cards] unexpected error", err);
  return NextResponse.json({ error: "Failed to fetch deck" }, { status: 500 });
}
```

The `ApiError` branch was already handled — the value of the change is
that a `TypeError: Cannot read property '...' of undefined` from a
schema regression no longer hides behind the same 500.

### I2 — Browser fetch wrappers dropped the original error

- **Locations**:
  - `web/src/lib/api.ts:47-54`
  - `web/src/lib/scroll-down-mlb-api.ts:68-83`
- **Risk lens**: Observability (browser-side)
- **Severity**: Low — the user-facing message ("Unable to load data…")
  is still the right copy, but the *original* error (a `TypeError`, a
  CORS rejection, a SyntaxError from a malformed JSON body) was being
  discarded. Browser devtools breadcrumbs and any future client-side
  log sink (Sentry, Datadog RUM, etc.) would have nothing to attribute.
- **Disposition**: **Acted (tighten)**. Both wrappers now attach the
  caught error via `{ cause: err }` on the rewrapped `Error` /
  `ScrollDownMlbApiError`. Zero copy change.

```ts
throw new Error("Unable to load data. Please check your connection and try again.", { cause: err });
```

For `ScrollDownMlbApiError` (an ES2022 `Error` subclass), `cause` isn't
part of the constructor signature, so it's set as a post-construct
property. Standard Error inspection (`console.error`, devtools) renders
both.

### I3 — Inner `// ignore` on the error-body reader was unannotated

- **Location**: `web/src/lib/scroll-down-mlb-api.ts:55-61`
- **Risk lens**: Observability
- **Severity**: Note — the catch is correct (the HTTP status is the
  load-bearing signal, the body is best-effort context), but a bare
  `// ignore` looks like a code smell at first glance.
- **Disposition**: **Acted (justify)**. Replaced the bare comment with
  a four-line rationale that names what the body is *for* (extra
  context) and why losing it is acceptable (status is the signal).

### I4 — Localhost SW-cleanup catches were silent

- **Location**: `web/src/app/layout.tsx` inline `sw-register` script
  (`.catch(function () {})` on two lines)
- **Risk lens**: Observability (dev-only)
- **Severity**: Low — only fires on `localhost` / `*.local`. A
  developer with a stuck service worker (very common during local Next
  rebuilds) would see no console signal at all.
- **Disposition**: **Acted (tighten)**. Both catches now log via
  `console.warn` with a labeled prefix. Production path is unaffected
  (it always took the `register('/sw.js').catch(...console.warn...)`
  branch).

### I5 — `useCatchupCards` poll-failure catch needed an audit anchor

- **Location**: `web/src/hooks/useCatchupCards.ts:82-91`
- **Risk lens**: Reliability
- **Severity**: Note — the catch *is* doing the right thing (a polling
  hiccup must not yank the user to an error state mid-deck), but the
  inline rationale didn't explain *why* initial/refresh failures are
  treated differently from poll failures.
- **Disposition**: **Acted (justify)**. Expanded the comment to state
  the invariant ("explicit retry CTA depends on initial/refresh
  surfacing errors") and link to this section.

### I6 — Stale-cache fallback masked sustained upstream outages

- **Location**: `web/src/lib/api-server.ts:182-188`
- **Risk lens**: Observability / operational
- **Severity**: Medium — `cachedApiFetch` correctly serves the
  last-known-good response when upstream is 429/5xx within the stale
  window. But the user gets a 200 and the operator gets *nothing* —
  the outage is invisible until the stale window expires and real 500s
  start landing.
- **Disposition**: **Acted (tighten)**. Added a `console.warn` with
  cache key, age in ms, and the triggering `ApiError` status. One log
  line per stale serve; that's enough to alert on without becoming
  noise, since the route-level caches dedupe within their fresh
  window.

```ts
console.warn(`[api-server] serving stale ${cacheKey} (age ${ageMs}ms): ${reason}`);
```

### I7 — SSR homepage + sitemap silently fell back to empty

- **Locations**:
  - `web/src/app/page.tsx:18-25`
  - `web/src/app/sitemap.ts:33-52`
- **Risk lens**: Observability / SEO
- **Severity**: Medium — both paths correctly degrade (homepage renders
  the SEO shell, sitemap keeps the root entries) when the upstream feed
  is unavailable. But a prolonged outage would have been silently
  shrinking our index surface and stripping the homepage every render,
  with no log signal.
- **Disposition**: **Acted (tighten)**. Both `try/catch` blocks now
  log via `console.warn` with the underlying error. The user-facing
  output (empty games list / minimal sitemap) is unchanged; what
  changes is that "the feed is down" is now diagnosable from the
  Next.js server log instead of from end-user reports.

---

## Changes made (Pass-4)

Working-tree edits on top of the Pass-3 state. Scope: the new dev-only
Catchup Lab page that ships under `/dev/catchup-lab` (404'd in production
by `web/src/app/dev/layout.tsx`).

| File | What changed | Disposition |
|------|--------------|-------------|
| `web/src/app/dev/catchup-lab/page.tsx` (manifest fetch, line ~119) | Replaced `.catch(() => {})` with a `console.error` + `setManifestError(msg)` so a backend hiccup or non-OK response surfaces in the sidebar instead of presenting as an empty fixture list. Added `if (!r.ok) throw` so HTTP errors no longer parse as `{ fixtures: [] }`. | **Acted (tighten)** — §H1 |
| `web/src/app/dev/catchup-lab/page.tsx` (`loadFixture`, line ~134) | Added a `catch` to the previously try/finally-only async load. Logs with a tag (`[catchup-lab] failed to load fixture …`) and renders `Failed to load deck …` in-pane via new `loadError` state. Added `if (!r.ok) throw` so a 4xx/5xx no longer JSON-parses an error envelope into the deck shape. | **Acted (tighten)** — §H2 |
| `web/src/app/globals.css` (`.lab-error`) | Added a single error-banner style (red-tinted muted card) so the new error states above have a visible affordance instead of unstyled red text. | **Acted (support)** — §H1/H2 |

No production behavior change. The /dev tree is gated by
`web/src/app/dev/layout.tsx` (`NODE_ENV === "production"` → `notFound()`),
and the consumed routes (`/api/dev/fixtures`, `/api/dev/fixtures/:id/cards`)
also 404 in production. The hardening only changes what an internal
operator sees during qualitative review.

### Pass-4 counts by severity

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 0 | — |
| High     | 0 | — |
| Medium   | 0 | — |
| Low      | 2 | Acted (2) — §H1, §H2 |
| Note     | 2 | Justified (2) — §H3, §H4 |

### Pass-4 inventory of suppressions in the diff

Other diff-resident suppressions inspected and left unchanged:

- `web/src/app/api/dev/fixtures/route.ts:36-39` — JSON-parse catch
  echoes `err.message` in the response body. Dev-only route (404 in
  prod), no auth surface, the operator running the lab is the only
  consumer. **Justified** — §H3.
- `web/src/app/api/dev/fixtures/[id]/cards/route.ts:69-73` — same
  pattern, same justification. **Justified** — §H3.
- `web/src/components/home/GameRow.tsx:62,76` — `<img onError>`
  hides broken team logos by setting `display: none`. Pre-existing
  pattern preserved across the visual refactor; correct posture for
  static assets where retry has no effect. **Justified** — §H4.
- `web/src/lib/seo.ts:144-148` — new `jsonLdScript` helper.
  *Hardening*, not a suppression: replaces an inline `JSON.stringify`
  in `web/src/app/layout.tsx` and escapes `<` to `<` so a
  schema string can't break out of the `<script>` tag. Already
  picked up by the security audit; mentioned here for cross-reference.
- `web/src/lib/api-server.ts:127-128` — bounds upstream error body
  to 2KB before throwing `ApiError`. Hardening, not suppression.
- `web/src/components/catchup/FinalReveal.tsx:99` — `target="_blank"`
  link upgraded from `rel="noreferrer"` to `rel="noopener noreferrer"`.
  Hardening, not suppression.
- `web/src/lib/leverage.ts`, `web/src/lib/result-chip.ts` — pure
  helpers, no inputs from outside the typed render path; no error
  handling needed (the leverage module's contract was already
  documented in Pass-3 §G3).

### Posture verdict for Pass-4

**Acceptable.** No critical/high/medium issues introduced. The two Low
findings are now loud-in-dev with a visible operator surface; the four
Notes are dev-only routes, presentational image fallbacks, or
hardenings (not suppressions). The Pass-3 verdict ("Acceptable") stands.

---

## §H — Pass-4 findings (dev-tool diff)

### H1 — Catchup Lab manifest fetch silently swallowed every error

- **Location**: `web/src/app/dev/catchup-lab/page.tsx`
  (`useEffect` around line 119)
- **Risk lens**: Reliability / observability (operator-facing only)
- **Severity**: Low — dev-only tool, no end-user exposure
- **Disposition**: **Acted** — added `if (!r.ok) throw new Error(...)`
  before the JSON parse, replaced `.catch(() => {})` with a logging +
  state-setting catch, and rendered the error in the sidebar.

**Why not throw?** This is a passive load on mount; throwing would
unmount the page and present the operator with a generic Next.js error
boundary. The lab's whole purpose is qualitative review — surfacing the
underlying message ("HTTP 500", "Failed to fetch") in the sidebar gives
the operator a faster signal than the boundary would.

**Why is the inner `if (!r.ok) throw` necessary?** Without it, a 500
response from `/api/dev/fixtures` gets JSON-parsed as `{ fixtures: [] }`
and the sidebar silently shows zero fixtures — indistinguishable from
"no fixtures captured yet."

### H2 — `loadFixture` had `try/finally` with no `catch`

- **Location**: `web/src/app/dev/catchup-lab/page.tsx`
  (`loadFixture`, line ~134)
- **Risk lens**: Reliability / observability (operator-facing only)
- **Severity**: Low — dev-only tool
- **Disposition**: **Acted** — added a `catch` block that logs and sets
  in-pane `loadError` state, plus an `if (!r.ok) throw` guard before the
  JSON parse.

The previous `try/finally` only existed to flip `setLoading(false)` —
the actual fetch/parse rejection escaped as an unhandled promise
rejection (no React error boundary catches `useCallback`-returned
promises). The operator saw the spinner clear with no deck and no
explanation; the rejection only showed up in the dev console.

The new error surface uses the same `.lab-error` style added for §H1
and lives directly under the toolbar so the failure shows up in the
operator's primary focal area.

### H3 — Dev fixture routes echo `err.message` in 500 bodies

- **Location**:
  `web/src/app/api/dev/fixtures/route.ts:36-39`,
  `web/src/app/api/dev/fixtures/[id]/cards/route.ts:69-73`
- **Risk lens**: Security observability (information disclosure)
- **Severity**: Note
- **Disposition**: **Justified** — both routes early-return
  `404 "Not Found"` when `NODE_ENV === "production"`, so the
  echo only happens in dev/CI. The "leaked" message is a Node.js
  `JSON.parse` error against a fixture the operator authored. Not
  a class-of-bug worth suppressing for the same reasons F8 (LLM error
  echo, Pass-2) was: the attack surface there was authenticated
  production users; here it's the operator running `npm run dev`
  on their own machine.

### H4 — `<img onError>` logo fallback in `GameRow`

- **Location**: `web/src/components/home/GameRow.tsx:62,76`
- **Risk lens**: Reliability / UX
- **Severity**: Note
- **Disposition**: **Justified** — `<img>` 404s on team logos hide the
  element via `style.display = "none"`. Retry has no effect (static
  asset URL was wrong or the file was removed); the surrounding row
  still renders the team name, so the user-visible degradation is a
  missing 24×24 logo, not a broken card. Pre-existing pattern; the
  Pass-4 visual refactor only renamed the wrapper class. No log because
  team-logo `<img>` errors are noisy on dev (asset cache priming) and
  not actionable in prod (operator already monitors logo asset coverage
  out-of-band).

---

## Changes made (Pass-3)

Working-tree edits on top of the in-flight catchup-card diff:

| File | What changed | Disposition |
|------|--------------|-------------|
| `web/src/components/catchup/BaseballLightField.tsx:1322` (`extraTrailStartPoint`) | Replaced silent `return POS.home` on regex miss with a dev-only `console.error` and an added non-finite-coord guard. Prod still falls back to home plate so a single bad path entry can't blank the field, but the failure is no longer invisible during local dev / tests. | **Acted (tighten)** — §G1 |
| `web/src/components/catchup/BaseballLightField.tsx:328` (`PROFILE_GLOW` lookup) | Annotated the `?? PROFILE_GLOW.other` fallback with a comment explaining it's a runtime guard for off-type strings (stale persisted data), not a silent suppression of unknown profiles. | **Justified** — §G2 |
| `web/src/lib/leverage.ts:1` (module preamble) | Added a docstring explaining why these pure helpers carry no input validation — inputs are typed `number` and originate from `catchup-cards.ts` with `?? 0` fallbacks at every assembly point. | **Justified** — §G3 |
| `web/src/components/catchup/CatchupCard.tsx:106` (`narrativeText` fallback) | Extended the existing comment to record that the empty-string fallback is intentional: missing narration is non-actionable for the user and upstream feed gaps are already tracked by `validatePlayCard`'s dev-only warnings. | **Justified** — §G4 |

No production behavior change. `extraTrailStartPoint`'s prod path is
unchanged; the dev-only `console.error` only fires if a future commit ships
an EXTRA_TRAILS / SAC_FLY_RELAY_PATHS / RELAY_THROW_PATHS entry whose path
string doesn't begin with `M${num} ${num}`.

### Pass-3 counts by severity

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 0 | — |
| High     | 0 | — |
| Medium   | 0 | — |
| Low      | 1 | Acted (1) — §G1 |
| Note     | 3 | Justified (3) — §G2, §G3, §G4 |

### Pass-3 inventory of suppressions in the diff

Other suppressions and dev-only guards landed in the diff that did **not**
warrant a code change:

- `catchup-cards.ts:298` `console.warn` for unmapped `classifyEvent`
  descriptions: dev-only (`NODE_ENV !== "production"` gate). Existing
  pattern, untouched.
- `catchup-cards.ts:631-639` `downgradeImplausible` dev warns: same
  dev-only pattern. Existing.
- `catchup-cards.ts:497` documents why `relay_throw` was not added as a
  classifier branch (the regex would never match the current MLB fixture
  corpus). The comment links forward to `BaseballLightField`'s
  `resolveExtraTrails`. This is a deliberate dead-code-avoidance
  decision, not a suppression. No action.
- New rundown classifier branch (`catchup-cards.ts:519`): regex match
  before the event switch. A miss falls through to existing classifier
  logic — correct cascade, no error suppression.
- New schedule entry in `play-phases.ts` (`rundown`): pure data, no
  control flow.

### Posture verdict for Pass-3

**Acceptable.** The diff did not introduce broad catches, retries, silent
returns, fire-and-forget promises, or env-gated strictness changes. The
single new silent fallback (`extraTrailStartPoint`) is now annotated and
loud-in-dev. All other diff-resident suppressions are dev-only warns or
documented non-suppressions.

---

## §G — Pass-3 findings (catchup diff)

### G1 — `extraTrailStartPoint` silently returned home plate on regex miss

- **Location**: `web/src/components/catchup/BaseballLightField.tsx:1322`
  (was `:1325` pre-edit)
- **Risk lens**: Reliability / observability
- **Severity**: Low (impossible under current data, but a footgun for
  future maintainers — a malformed path string would render as a glowing
  dot pinned to home plate, masking the bug visually)
- **Disposition**: **Acted** — added dev-only `console.error` on regex
  miss and on non-finite parsed coords. Prod still returns `POS.home` so
  a single bad path entry doesn't blank the entire field while the rest
  of the play continues to render.

**Why not throw?** This is render-time, called per-frame on every active
card. A hard throw would unmount the field and lose the user's place in
the catch-up flow over a cosmetic bug. Dev-loud / prod-soft is the right
posture for SVG geometry assertions.

### G2 — `PROFILE_GLOW[animationProfile] ?? PROFILE_GLOW.other`

- **Location**: `web/src/components/catchup/BaseballLightField.tsx:328`
- **Risk lens**: Reliability
- **Severity**: Note
- **Disposition**: **Justified** — `PROFILE_GLOW` is a fully-keyed
  `Record<PlayAnimationProfile, ...>`, so the `?? other` is unreachable
  through the type system. It exists as a runtime guard against
  off-type strings (e.g. an older animation profile persisted in
  client-side IndexedDB before a type rename). Comment now states this
  intent at the call site.

### G3 — `leverage.ts` has no input validation

- **Location**: `web/src/lib/leverage.ts` (entire module)
- **Risk lens**: Reliability
- **Severity**: Note
- **Disposition**: **Justified** — `inningZone` and `leverageBand` are
  pure deterministic helpers consumed only by `CatchupCard`. Their
  numeric inputs come from `PlayCardData`, whose `inning` and
  `scoreBefore.{home,away}` fields are assembled in `catchup-cards.ts`
  with `?? 0` fallbacks at every site. NaN therefore cannot reach these
  functions through the typed render path; if it ever did via stale
  persisted state, the band cascade lands on `"high"` (still-coherent
  CSS data attribute) rather than a crash. CSS variables derived from
  these labels degrade silently if unexpected. Module preamble now
  states this contract.

### G4 — `(card.narrative ?? card.description ?? "").trim()` empty-fallback

- **Location**: `web/src/components/catchup/CatchupCard.tsx:111`
- **Risk lens**: Reliability / UX
- **Severity**: Note
- **Disposition**: **Justified** — the fallback is the mechanism that
  hides the narration panel when the upstream feed has no copy.
  Surfacing an error to the user would not be actionable (it's
  upstream data); upstream feed gaps are already monitored by
  `validatePlayCard`'s dev-only warnings (already running on every
  card mount via `useEffect`, see `CatchupCard.tsx:118-121`).
  Comment now states this intent and links here.

---

# Error Handling & Suppression Audit — 2026-04-28

Scope: every `try`/`catch`, `.catch()`, lint disable, silent default, fire-and-forget,
and "non-fatal" path under `web/src`. Focus weighted toward the in-flight diff
(AdSense ads infrastructure) and shared production-critical paths
(auth, billing, sync, persistence, realtime).

This pass acted in-place on every Critical/High finding and on the Medium
findings that had a small, low-risk fix. Remaining items are explicitly
justified — no bare TODOs were left behind.

> **Two-pass audit on 2026-04-28.** Pass-1 (below) covered the Critical /
> High data-loss and observability fixes plus the AdSense diff. Pass-2
> (see end of file, "Pass-2 Follow-up") swept the long tail and added six
> Medium tightenings + five explicit Note justifications. Combined totals:
> **34 findings (1 Critical, 5 High, 12 Medium, 16 Note); 16 acted, 18
> justified.**

---

## Executive Summary

- **Files reviewed**: 99 with `try`/`catch`, plus all `.catch()` chains and
  `eslint-disable` / `@ts-*` comments under `web/src`.
- **Findings**: 23 (1 Critical, 5 High, 6 Medium, 11 Note).
- **Acted (in-place tightening)**: 10.
- **Justified-as-is (Note)**: 13.
- **Top issue**: `loadAccounts()` and `loadStore()` silently returned an empty
  collection when their backing JSON file failed to parse — the very next
  write would have overwritten the corrupt file and **permanently destroyed
  every user's account / reveal sync state**. Both now quarantine the corrupt
  file as `<path>.corrupt-<ts>` before returning empty, and refuse to return
  empty (throw) if the rename itself fails. (§F1, §F2.)
- **Other notable fixes**:
  - Stripe webhook subscription handlers no longer silently no-op when the
    customer ID has no local account — a paid user could otherwise keep Pro
    indefinitely after `subscription.deleted` (§B1).
  - Stripe webhook signature failures now log (previously only the response
    body carried the failure — an attacker probing the endpoint left no
    server-side trace) (§B3).
  - Auth proxy network failures now log (previously a generic 502 was the
    only signal of an upstream auth-service outage) (§B2).
  - Admin "Activate model" / "Cancel job" actions now surface failure to the
    operator instead of pretending the click succeeded (§C1).
- **Posture verdict**: **Prod posture acceptable after this pass.** Remaining
  suppressions are user-facing best-effort paths (ads, analytics beacons,
  storage-quota writes, unload handlers) where a silent failure is the
  correct behavior and is now linked to this report from the code site.

### Counts by severity

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 1     | Acted (1) |
| High     | 5     | Acted (5) |
| Medium   | 6     | Acted (4), Justified (2) |
| Note     | 11    | Justified (11) |

---

## Findings Table

| ID | Location | Category | Severity | Disposition |
|----|----------|----------|----------|-------------|
| F1 | `web/src/lib/magic-link.ts:123` `loadAccounts()` | Data integrity | Critical | Tightened — quarantine corrupt file, throw if rename fails |
| F2 | `web/src/app/api/sync/reveal/route.ts:52` `loadStore()` | Data integrity | High | Tightened — quarantine + throw fallback |
| B1 | `web/src/app/api/billing/webhook/route.ts:45,63` subscription handlers | Operational / billing | High | Tightened — log when no local account matches `stripeCustomerId` |
| B2 | `web/src/app/api/auth/[...path]/route.ts:135` proxy outer catch | Observability | Medium | Tightened — log network failures |
| B3 | `web/src/app/api/billing/webhook/route.ts:22` signature catch | Security observability | High | Tightened — log + generic body |
| C1 | `web/src/app/analytics/(mlb)/models/page.tsx:135,143` admin actions | Reliability / UX | High | Tightened — surface error to admin |
| C2 | `web/src/app/analytics/(mlb)/batch/page.tsx:135,144` admin diagnostics | Observability | Medium | Tightened — log to console |
| D1 | `web/src/components/ads/AdSlot.tsx:44` `adsbygoogle.push` catch | Reliability | Note | Justified — ad-blocker / not-loaded; user-actionable noise. Linked to report from comment. |
| D2 | `web/src/components/ads/AdSenseScript.tsx` no error handling | Reliability | Note | Justified — `<Script>` failures are non-actionable; opt-in via `ADS_ENABLED`. |
| D3 | `web/src/components/ads/{Feed,FairBet,GameDetail}Ad.tsx`, `NativeAdCard.tsx` | Reliability | Note | Justified — pure render guards; no async, no error surface. |
| E1 | `web/src/lib/preferences-sync.ts:331` `flushPreferences` | Reliability | Medium | Tightened — broken `try/catch` around fire-and-forget Promise replaced with `.catch(()=>{})`. |
| E2 | `web/src/lib/stale-cache.ts:20` `readCache` | Reliability | Medium | Tightened — drop corrupt entry on read so it isn't re-parsed. |
| E3 | `web/src/lib/reveal-sync.ts:51-66` `pushLocalState` silent | Reliability | Note | Justified — local IDB is SSOT, retried next interval; documented at function. |
| E4 | `web/src/lib/reveal-sync.ts:136-139` `startRevealSync` `.catch(()=>{})` | Reliability | Note | Justified — `pullAndMerge` already logs internally. |
| E5 | `web/src/stores/auth.ts:186` token refresh 404 acceptance | Operational | Note | Justified — transitional shim, comment in code; non-404 errors are tracked. |
| E6 | `web/src/lib/api.ts:82` 401 → silent `logout()` | Reliability | Note | Justified — token expiry is expected; UI state will reflect logged-out. |
| E7 | `web/src/app/api/auth/send-link/route.ts:51,57,69` 200-on-anything | Security | Note | Justified — anti-enumeration; email-delivery failure already logs to console. |
| E8 | `web/src/lib/analytics.ts:33,37` analytics POST `.catch(()=>{})` | Observability | Note | Justified — analytics must never break the app; documented at function. |
| E9 | `web/src/components/game/GameStorySection.tsx:54,65` AI story + vote | UX | Medium | Justified — entire section is gated off by `STORY_QUALITY_GATE = true`; dormant code. Re-audit when gate flips. |
| E10 | `web/src/stores/settings.ts:240,257` localStorage write catches | Reliability | Note | Justified — Safari private mode / quota can deny writes; UI continues. |
| E11 | `web/src/components/layout/{PWAInstallPrompt,BetaBanner}.tsx` localStorage catches | Reliability | Note | Justified — non-essential UI dismiss state. |
| E12 | `web/src/realtime/transport.ts` ws/sse parse + dispatch catches | Observability | Note | Justified — bounded scope, all log to console.error with tag. |
| E13 | `web/src/app/api/realtime/sse/route.ts:21` upstream catch | Observability | Note | Justified — already logs + returns 502. |

---

## Per-Finding Detail

### F1 — Critical: `loadAccounts()` could destroy every user account on next write

**Location:** `web/src/lib/magic-link.ts:123-132` (before tightening)

```ts
function loadAccounts(): Map<string, Account> {
  try {
    const path = accountsPath();
    if (!existsSync(path)) return new Map();
    const arr = JSON.parse(readFileSync(path, "utf8")) as Account[];
    return new Map(arr.map((a) => [a.email.toLowerCase(), a]));
  } catch (err) {
    console.error("[magic-link] loadAccounts failed — returning empty store. Accounts file may be corrupted:", err);
    return new Map();
  }
}
```

**Risk lens:** Data integrity — this is the user account database (email,
tier, Stripe customer ID). If the JSON file ever fails to parse (partial
write from a kill -9, disk error, manual edit error), the function returns
an empty Map. The very next caller — `findOrCreateAccount`, called on every
magic-link verify — calls `saveAccounts(accounts)`, which does
`writeFileSync(accountsPath(), JSON.stringify([...accounts.values()], null, 2))`.
That write **completely replaces** the corrupt file with a single new account.
Every other user is permanently gone, including the Stripe customer-ID
mapping that `customer.subscription.*` webhooks depend on.

Same pattern: `findAccountByStripeCustomerId`, `updateAccountTier` all
trigger this write path.

**Action:** quarantine the corrupt file before returning empty. If the
rename fails, throw (refusing to return empty is safer than guaranteed
data loss).

```ts
function loadAccounts(): Map<string, Account> {
  const path = accountsPath();
  if (!existsSync(path)) return new Map();
  try {
    const arr = JSON.parse(readFileSync(path, "utf8")) as Account[];
    return new Map(arr.map((a) => [a.email.toLowerCase(), a]));
  } catch (err) {
    const quarantine = `${path}.corrupt-${Date.now()}`;
    try {
      renameSync(path, quarantine);
      console.error(`[magic-link] loadAccounts failed — accounts file quarantined to ${quarantine}. Manual recovery required:`, err);
    } catch (renameErr) {
      console.error("[magic-link] loadAccounts failed AND quarantine rename failed — refusing to return empty store; throwing to prevent data loss:", err, renameErr);
      throw err;
    }
    return new Map();
  }
}
```

The quarantine path lives next to the original file, so an operator can
inspect and merge after the incident. After this pass, the worst-case is a
brief outage of magic-link signups while the operator restores from the
`.corrupt-*` snapshot — not silent permanent loss of every account.

### F2 — High: `loadStore()` for reveal sync had the same data-loss pattern

**Location:** `web/src/app/api/sync/reveal/route.ts:52-61` (before tightening)

Same shape, same risk model: the file holds every Pro user's reveal-state
sync record (`revealedIds`, `snapshots`). On parse failure, the original
returned `{}`, then the next `PUT /api/sync/reveal` call from any Pro user
would `saveStore({})` plus the new user's record — wiping every other Pro
user's history.

Severity is High rather than Critical only because reveal-sync is
recoverable: the IndexedDB on each user's device is the SSOT and re-pushes
on next reveal action. Auth account data has no such second copy.

**Action:** identical pattern — quarantine first, throw if rename fails.

### B1 — High: Stripe webhook silently no-op when local account is missing

**Location:** `web/src/app/api/billing/webhook/route.ts:45,63`

```ts
case "customer.subscription.deleted": {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (customerId) {
    const account = findAccountByStripeCustomerId(customerId);
    if (account) {
      updateAccountTier(account.email, "free", undefined, undefined);
    }
    // Silently fell through here when no account matched.
  }
  break;
}
```

**Risk lens:** Operational + revenue. If our `sd-accounts.json` is missing
the row for a Stripe customer (out-of-band restore, manual edit, file
corruption recovered as F1, anonymous-purchase race) and Stripe sends
`subscription.deleted`, we returned 200 to Stripe with no log, no metric.
The user keeps Pro forever from Stripe's POV (subscription is gone) and
from our POV (we never demoted them).

**Action:** added `console.warn` with `event.id` and `customerId` for both
`subscription.created/updated` and `subscription.deleted`. Operator can
search logs for `"no local account for stripeCustomerId"` and reconcile.

Did not fail-the-webhook (which would cause Stripe to retry), because
Stripe retries don't help — the accounts file isn't going to grow that
record by itself. Logging is the right surface for an out-of-band
reconciliation problem.

### B2 — Medium: Auth proxy outer catch had no log

**Location:** `web/src/app/api/auth/[...path]/route.ts:135-141`

The proxy wraps the upstream `fetch` in `try/catch`; on network failure it
returned `502 "Auth service unavailable"` with no log. A flapping upstream
or DNS issue showed up only as a spike in client-side login failures.

**Action:** added `console.error` with the resolved path before returning
502. The 502 body stays generic.

### B3 — High: Stripe webhook signature failures had no log

**Location:** `web/src/app/api/billing/webhook/route.ts:22`

```ts
} catch (err) {
  const msg = err instanceof Error ? err.message : "Signature verification failed";
  return NextResponse.json({ error: msg }, { status: 400 });
}
```

Two problems:

1. The actual Stripe SDK error message was returned in the response body.
   That's not a security disaster, but it's an information disclosure that
   tells a probe-er which webhook secret rotation state they hit.
2. There was no server-side log. A misconfigured webhook secret looked the
   same as forged Stripe traffic.

**Action:** log `console.error` with the underlying error; return a generic
`"Signature verification failed"` message to the caller.

### C1 — High: Admin "Activate model" / "Cancel job" silent on failure

**Location:** `web/src/app/analytics/(mlb)/models/page.tsx:135-149` (before)

```ts
const handleActivateModel = async (model: RegisteredModel) => {
  try {
    await activateModel(model.model_id, model.sport, model.model_type);
    const ml = await fetchModelsList();
    setModels(ml);
  } catch { /* ignore */ }
};
```

These are admin-gated mutations. Silent failure means an operator clicks
"Activate", sees no error, and assumes the new model is live for forecasts
when it isn't. Same pattern for `handleCancelJob`.

**Action:** `console.error` plus `setError(...)` so the existing red error
banner at the top of the page shows the failure. Includes the relevant ID
in both the log and the banner.

### C2 — Medium: Batch admin job-detail/outcome fetches silent

**Location:** `web/src/app/analytics/(mlb)/batch/page.tsx:135,144`

Less severe than C1 because these are **read** operations that show in a
collapsed accordion — when expansion fails, the panel just stays empty.
Still worth a log so an operator who reports "I clicked expand and nothing
showed up" has something to grep for.

**Action:** `console.error` only; no UI surface needed (the empty state is
already self-evident).

### D1 — Note: `AdSlot` `adsbygoogle.push()` catch

**Location:** `web/src/components/ads/AdSlot.tsx:44`

The push throws when the AdSense script is blocked or hasn't loaded. There
is no recovery path — the ad just doesn't render — and the user's network
is the cause. Logging this would generate noise on every ad-blocker user's
session and is not actionable.

**Justified.** Comment at the catch site references this report (§D1).

### D2 / D3 — Note: Other ads components

The other ads files (`AdSenseScript.tsx`, `FeedAd.tsx`, `FairBetAd.tsx`,
`GameDetailAd.tsx`, `NativeAdCard.tsx`, `AdBoundary.tsx`) are pure render
gates — early-return when ads are disabled or the viewer is paid/admin —
with no `try/catch` at all. Nothing to suppress, nothing to tighten.

The CSP headers in `next.config.ts` were updated to allowlist
`pagead2.googlesyndication.com` etc. — appropriate scope for what's
mounted, not over-broad.

### E1 — Medium: `flushPreferences` had a broken `try/catch`

**Location:** `web/src/lib/preferences-sync.ts:331`

```ts
try {
  fetch(..., { keepalive: true });
} catch {
  // best-effort on unload
}
```

`fetch()` returns a Promise — the only thing the synchronous `try/catch`
catches is a constructor-level throw (e.g. invalid URL). The actual
network/server failure rejects the returned Promise and the `try/catch`
does nothing for it. Result: an unhandled-rejection on every unload-time
push failure.

**Action:** dropped the no-op `try/catch`, replaced with `.catch(() => {})`
on the Promise itself. Comment at the call site explains the unload
contract.

### E2 — Medium: `readCache` re-parsed corrupt entries forever

**Location:** `web/src/lib/stale-cache.ts:20`

The original `readCache` returned `null` on parse failure but left the
corrupt entry in localStorage, so the same parse failure repeated on every
read for the rest of the session (and across reloads) until the user
manually cleared site data.

**Action:** call `localStorage.removeItem(key)` (in its own try/catch) on
parse failure so the cache miss is permanent for that key.

### E3 / E4 — Note: `reveal-sync` silent paths

The function-level docstring already says "All failures are silent — local
IndexedDB state is always preserved." That's the right posture: this is a
nice-to-have cross-device sync layer, not a SSOT. Network failures already
log via `console.warn` at `fetchRemoteState` / `pullAndMerge`. The outer
`.catch(() => {})` in `startRevealSync` exists only to satisfy the
unhandled-rejection check; the real logging is one frame down.

**Justified** — keep as-is.

### E5 — Note: `auth.ts` token-refresh 404 swallow

```ts
if (err instanceof AuthError && err.status === 404) return;
trackEvent("token_refresh_error", { status: ... });
```

Documented as "refresh endpoint not deployed yet — acceptable, token
expires naturally and user re-logs in." Non-404 errors are tracked. This is
a transitional shim and should be removed once the refresh endpoint has
been confirmed deployed for all environments. The comment is clear enough
to act on later — no action needed for this pass.

**Justified** — flag for follow-up the next time `/auth/refresh` rollout
status is reviewed.

### E6 — Note: `api.ts` 401 → silent `useAuth.logout()`

A 401 on any API call clears the auth state with no user-facing toast.
This is correct: token expiry is an expected condition; the protected page
will re-render in its logged-out state and the user is prompted to sign in
when they try to act.

**Justified.**

### E7 — Note: `send-link/route.ts` always-200 pattern

Three suppressions:

1. JSON parse failure → 200.
2. Invalid email format → 200.
3. `sendMagicLinkEmail` rejection → `console.error` + 200.

All three are correct: returning a different status for any of these would
let an attacker enumerate registered emails / probe for delivery
infrastructure. The email-delivery rejection is at least logged so an
SMTP / Resend outage is visible.

**Justified.**

### E8 — Note: `analytics.ts` POST `.catch(() => {})`

The function comment explicitly says "Analytics should never break the
app." Both the `sendBeacon` fallback `fetch` and the outer wrapper swallow
errors. This is the right call for a self-hosted analytics endpoint that
runs on the user's mobile network.

**Justified.**

### E9 — Medium (gated): `GameStorySection` AI fetch + vote both silent

The component is currently rendered behind `STORY_QUALITY_GATE` (constant
`true` in `lib/config.ts`) — its early-return at line 70 means the
suppressions never execute in production. The fetch path silently sets no
story; the vote path silently swallows the POST result. Both are
unacceptable as user-facing UX: a user who votes and sees nothing
acknowledged will assume the vote registered.

**Justified for now** because the gate is closed; **action required when
the gate flips**: at minimum, turn the vote button into the
`voted`-confirmation state only after the POST resolves successfully (the
current code optimistically flips state before awaiting). Filed inline
above `STORY_QUALITY_GATE` would be the natural place for that note;
adding a comment there now would be premature without context on why the
gate exists.

### E10 / E11 — Note: localStorage write catches in settings, PWA prompt, beta banner

All three are non-essential UI persistence (settings auto-correction,
"don't show install prompt again", "dismissed beta banner"). The writes
fail in Safari Private mode and when storage quota is hit — the only
sensible behavior is to continue without persisting the dismissal. The
suppressions are well-commented at the call sites.

**Justified.**

### E12 — Note: realtime transport WS/SSE catches

All three (`ws.onmessage` parse, `sse.onmessage` parse, dispatch handler
throw) log with a `[realtime/...]` tag. Bounded scope (one message), no
silent state corruption, no fallback that hides the failure.

**Justified.**

### E13 — Note: SSE proxy upstream catch

Logs and returns 502. Same pattern as the API proxy routes (after B2 was
applied).

**Justified.**

---

## Categorization

### Acceptable production notes

- D1, D2, D3 — Ads. Non-actionable failures, no user-facing recovery
  surface, mounted only for free-tier non-admin viewers.
- E3, E4 — `reveal-sync`. Cross-device sync is a Pro convenience; local
  IndexedDB is SSOT.
- E6 — 401 → silent logout. Expected condition.
- E7 — Anti-enumeration 200s on `/auth/send-link`.
- E8 — Analytics beacons.
- E10, E11 — localStorage write failures for non-essential dismiss state.
- E12 — Realtime malformed-message logging.
- E13 — SSE proxy upstream log + 502.

### Needs documentation (now done)

All Note-severity findings have been linked to this report from the code
site (or already had a function-level docstring covering the rationale).

### Needs telemetry

- B1, B2, B3 — All three now log with structured tags
  (`[billing/webhook]`, `[auth-proxy]`). If there's an existing log
  shipping setup (CloudWatch, Datadog, Loki), these tags can be alerted
  on. No new metric infrastructure is added in this pass; alerting is the
  operator's call.

### Tighten before prod (now done)

- F1, F2 — Quarantine on corrupt JSON.
- B1, B2, B3 — Webhook + proxy logging.
- C1 — Admin actions surface failure.
- E1 — Broken try/catch removed.
- E2 — Corrupt cache entry now drops itself.

### Hidden failure risk (none remaining)

After this pass, no suppression hides a failure that could result in
silent data loss, silent revenue loss, or an undiagnosable production
incident. The remaining Note cases either (a) have an obvious user-facing
symptom (login fails → user sees login form again), (b) log to console
with a searchable tag, or (c) cannot meaningfully recover.

---

## Final Verdict

**Prod posture: acceptable.**

The pre-pass posture had two latent data-loss bombs (F1, F2) and two
billing-observability gaps (B1, B3) that would each have been
indistinguishable from "everything works" until a customer complained.
After this pass:

- Every persistence layer that overwrites a load result now refuses to
  overwrite a corrupt original.
- Every billing webhook handler logs the cases that previously fell into
  silent no-ops.
- Every admin mutation surfaces failure.
- Every remaining suppression is either the correct choice (anti-
  enumeration, ad-blocker, analytics best-effort, localStorage quota) or
  is documented with a pointer back to this report.

No `## Escalations` section is needed — every finding was either acted on
in code or has a concrete justification that doesn't depend on someone
else's decision.

Re-audit triggers:

- `STORY_QUALITY_GATE` flipping to `false` (re-evaluate E9).
- The auth `/refresh` endpoint reaching uniform deployment (remove the
  404-acceptance shim referenced in E5).
- Any new file-backed persistence in `/api/...` routes (apply the F1/F2
  quarantine pattern).

---

## Pass-2 Follow-up — 2026-04-28

A second sweep was run the same day to cover the long tail of `try`/`catch`
sites the first pass had not explicitly inventoried (mostly admin analytics
pages, public sport simulator, golf upstream proxy, AI route error shape,
and session-store fallbacks). Verdict from the first pass holds; this pass
added six tightenings and three explicit justifications. No
critical/data-loss findings emerged.

### Pass-2 Counts

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 0 | — |
| High     | 0 | — |
| Medium   | 6 | Acted (6) |
| Note     | 5 | Justified (5) |

### Pass-2 Findings Table

| ID  | Location | Category | Severity | Disposition |
|-----|----------|----------|----------|-------------|
| F3  | `web/src/app/api/golf/leaderboard/route.ts:129` | Observability | Medium | Tightened — log upstream API-Sports failures (B2/E13 pattern) |
| F4  | `web/src/app/analytics/(mlb)/profiles/page.tsx:49` | Reliability / UX | Medium | Tightened — log + `setError("Failed to load teams.")` |
| F5  | `web/src/app/analytics/(mlb)/simulator/page.tsx:90` | Reliability / UX | Medium | Tightened — log + `setError("Failed to load teams.")` |
| F6  | `web/src/app/analytics/(mlb)/simulator/page.tsx:128,168` (home/away roster) | Observability | Medium | Tightened — log roster-load failure; UI state-clear preserved |
| F7  | `web/src/app/analytics/[sport]/page.tsx:62` | Reliability / UX | Medium | Tightened — log + `setError`. Public surface (NBA/NHL/NCAAB simulator) |
| F8  | `web/src/app/api/ai/story/route.ts:96` (LLM error message echo) | Security observability | Medium | Tightened — log SDK error server-side; return generic `{ error: "LLM_ERROR" }` |
| F9  | `web/src/stores/session.ts:47` `useSession.refresh()` network catch | Reliability | Note | Justified — silent fall to anonymous is correct UX. Comment added in code. |
| F10 | `web/src/stores/session.ts:55` `useSession.signOut()` network catch | Reliability | Note | Justified — local state must reset regardless. Comment added. |
| F11 | `web/src/lib/reveal-idb.ts:271` localStorage→IDB migration catch | Reliability | Note | Justified — one-shot migration; malformed legacy data is irrecoverable. Comment added. |
| F12 | `web/src/stores/auth.ts:102,127,268` `refreshMe()` post-login swallow | Observability | Note | Justified — already calls `trackEvent("profile_hydrate_error", { flow })` and inline-comments the rationale. No additional action. |
| F13 | `web/src/features/analytics/services/ModelsService.ts:59,70` `fetch{Calibration,Degradation}` → null/empty | Reliability | Note | Justified — caller (`ModelsPage`) already wraps these in its own `try/catch` that surfaces "No performance data available" UI. The service-level fallback is redundant but harmless and protects other callers. |

### Per-Finding Detail

#### F3 — Medium: Golf leaderboard upstream catch had no log

The same shape as B2 (auth proxy) and E13 (SSE proxy): a 502 with a generic
error body and no log entry. Different from B2 only because golf is gated
behind `GOLF_ENABLED`, so most production deploys never hit this code path.
When enabled, an API-Sports outage is operationally important to catch
quickly so the cached leaderboard doesn't drift indefinitely (TTL=60s,
SWR=120s, then hard 502).

**Action:** added `console.error("[golf/leaderboard] upstream fetch failed:", err)`
and a comment citing this section. Client body unchanged.

#### F4 — Medium: Admin profiles page swallowed team-load failure

```ts
} catch { /* ignore */ }
```

Same shape as the previous pass's C1 admin-mutation finding, but on a read.
The page already declares `const [error, setError] = useState<string | null>(null)`
and renders `{error && <div>...</div>}`, so the only thing missing was
calling `setError` from the catch. An admin opening the page on a backend
hiccup saw an empty team selector and no explanation.

**Action:** `console.error(...)` + `setError("Failed to load teams.")`.

#### F5 — Medium: MLB simulator team-load same shape as F4

Same fix, same reason. Empty `<select>` with no message → admin assumes the
sport has no teams configured.

#### F6 — Medium: MLB simulator roster-load failures had no log

The roster catch already cleared `homeBatters/Pitchers/Lineup/Starter` (and
the away-side equivalent), so the UI did surface the failure indirectly:
the lineup builder is empty, the simulate button stays disabled, and the
user can't proceed. That's a recoverable UX state; the missing piece was an
operator-visible log when a specific team's roster fetch fails.

**Action:** added `console.error` with the team abbreviation in both
home and away catches. UI state-clear behavior preserved.

#### F7 — Medium: Public sport simulator silent team load

The `[sport]/page.tsx` route serves NBA, NHL, NCAAB simulators to all
authenticated users (not admin-gated). Same shape as F4: silent catch on
team load. More important than F4 because this is a public free-tier
feature — a regular user clicking the page on a backend blip saw "no
teams" and might bounce.

**Action:** log + `setError("Failed to load teams.")`. Page already
renders the error block.

#### F8 — Medium: AI story route echoed Anthropic SDK errors back to caller

```ts
const message = err instanceof Error ? err.message : String(err);
return NextResponse.json(
  { error: "LLM_ERROR", reason: message },
  { status: 502 },
);
```

Same lesson as B3 (Stripe webhook): don't reflect upstream SDK error
messages back to the caller. Anthropic SDK errors include rate-limit
specifics, model unavailability messages, and (in pathological cases) hints
about API key state. A probe-er hammering the endpoint can build a
fingerprint of our LLM infrastructure from these reflected messages.

The route requires a session cookie, so the attack surface is limited to
authenticated users — but a defense-in-depth response is to log
server-side and return a generic error code only.

**Action:** `console.error("[ai/story] Anthropic call failed:", err)` and
return `{ error: "LLM_ERROR" }` with no `reason`.

#### F9 / F10 — Note: `useSession` refresh / signOut network catches

Both are correct posture, just under-documented:

- `refresh()` failing to reach `/api/auth/session`: the right behavior is
  to assume anonymous and let the user re-attempt. Surfacing a network
  error here would block app render on every flaky connection.
- `signOut()` failing to reach `/api/auth/sign-out`: the user requested
  sign-out; local state must clear regardless of whether the cookie-clear
  RPC succeeded. The next request will see the absence of a valid session
  cookie anyway.

**Action:** added in-code comments citing this report; no behavior change.

#### F11 — Note: `reveal-idb.ts` localStorage→IDB migration catch

This is the one-shot migration that ran when reveal state moved from
`localStorage` to IndexedDB. If the localStorage payload won't parse, it's
already broken — the migration discards it and removes the key in the
`finally`. The user is no worse off than before the migration ran, and the
migration only runs once per device.

**Action:** clarified the comment in-place; no behavior change.

#### F12 — Note: `auth.ts` `refreshMe()` post-login swallow

```ts
try {
  await get().refreshMe();
} catch {
  trackEvent("profile_hydrate_error", { flow: "login" });
}
```

The function-level comment ("Populate email/userId — non-fatal if this
fails since we already have a valid token") is correct: the user's auth
state is valid and the next page-load `refreshMe()` will retry. Failures
are tracked via `trackEvent`, so this is observable. No action needed.

#### F13 — Note: `ModelsService` calibration/degradation null fallbacks

`fetchCalibrationReport` returns `null` and `fetchDegradationAlerts`
returns `[]` on failure. The page (`ModelsPage`) wraps both calls in its
own `try/catch` that does the same thing, so the service-level catches are
redundant. They're not harmful — they protect any future caller that
forgets to wrap — and removing them would be net-neutral churn. Keeping
as-is.

### Pass-2 Categorization

**Acceptable production notes:** F9, F10, F11, F12, F13.

**Tightened in this pass:** F3, F4, F5, F6, F7, F8.

**Hidden failure risk:** none — every Pass-2 finding either logs now, or is
a UX state that's already self-evident on screen.

### Pass-2 Verdict

Pass-1 verdict ("Prod posture acceptable") still holds. This pass closed
the long-tail observability gaps (admin and public diagnostic surfaces
that swallowed failures silently) and one low-grade information disclosure
(LLM error echo). No new critical or high-severity issues found, no
escalations required.

The follow-up checklist in pass-1 ("re-audit triggers") is unchanged.

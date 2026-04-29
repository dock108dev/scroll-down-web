# Docs Consolidation Pass — 2026-04-28

Scope: a full sweep of every Markdown file in the repo against the live code at
`HEAD` of `main`. Goal — every doc statement must be verifiable from
code / config / CI. Anything wrong, outdated, duplicated, or pointing at a
file that no longer exists was rewritten in place or deleted.

## Verification

Code-only audit; no behavior changes. The previous pass on the same day
recorded green status for the standard checks, and this pass left source
files untouched (one stale code comment is escalated below):

| Check                 | Result                                |
|-----------------------|---------------------------------------|
| `npx tsc --noEmit`    | not re-run (no `web/src` edits)       |
| `npm run lint`        | not re-run                            |
| `npm run test:unit`   | not re-run                            |

## Files touched

### Moved

| From                                  | To                          | Reason                                                                               |
|---------------------------------------|-----------------------------|--------------------------------------------------------------------------------------|
| `AIDLC_FUTURES.md` (root)             | `docs/aidlc-futures.md`     | Pass rule: root holds only `README.md` + customer-voice files. `AIDLC_FUTURES.md` is auto-generated tooling output, so it belongs under `/docs`. Internal links rewritten for the new depth. |

### Deleted

| Path                                  | Reason                                                                               |
|---------------------------------------|--------------------------------------------------------------------------------------|
| `docs/archived/aidlc-futures.md`      | Superseded by `docs/aidlc-futures.md` (current run). Pointed at five audit files that no longer exist under those names (`abend-handling.md`, `security-audit.md`, `ssot-cleanup.md`, `docs-consolidation.md`, `cleanup-report.md` at a stale path). Keeping it would be a maintenance burden with no historical value the audit reports themselves don't already preserve. |
| `docs/archived/`                      | Empty after the file above was deleted; the `archived/research/` subdirectory it advertised was never present in this repo. |

### Rewritten in place

| File                                  | What changed |
|---------------------------------------|--------------|
| `README.md` (root)                    | Fixed the standalone build path (`standalone/` → `.next/standalone/`, matches `web/package.json` `"build"` and `"start"` scripts). Added `docs/ADS_SETUP.md` to the doc table. Removed the table row pointing at a non-existent `CLAUDE.md`. Added a `BRAINDUMP.md` pointer. |
| `docs/README.md`                      | Replaced four broken audit-file links (`abend-handling.md`, `security-audit.md`, `ssot-cleanup.md`, `docs-consolidation.md`) with the actual filenames (`error-handling-report.md`, `security-report.md`, `ssot-report.md`, plus this report). Removed the `archived/braindump.md` and `archived/research/` rows (neither exists). Removed the `../CLAUDE.md` row (does not exist). Added `aidlc-futures.md` under "Archived" since the file moved there. |
| `docs/architecture.md`                | (1) Rewrote the CSP row to describe the actual policy in `web/next.config.ts`, including the AdSense origins on `script-src` / `connect-src` / `frame-src` / `img-src` and the `frame-ancestors 'none'` clause. (2) Removed the `R-4 in security audit` reference — there is no R-4 in any current audit; replaced with a pointer to the live tracker (`security-report.md` §J2 / nonce-CSP follow-up). (3) Added the `web/public/ads.txt` static-file note to the Ads paragraph. (4) Reveal store key clarified: actual persistence is IndexedDB DB `scroll-down`, with a one-shot migration from the legacy `sd-read-state` localStorage key. (5) Added `useIsPro` to the hooks table (it exists in `web/src/hooks/`). (6) Updated "15 hooks" comment in the directory tree to "16 hooks". (7) Added `profile_hydrate_error` to the analytics events list (it is emitted from `stores/auth.ts`). |
| `docs/state-management.md`            | Added the missing `game-core` and `my-bets` stores. Corrected the `reveal` store row: Zustand `persist` middleware is **not** used; persistence is IndexedDB via `lib/reveal-idb.ts`. Renamed bare numbers to their config constants (`STORAGE.MAX_REVEALED_IDS`, `STORAGE.MAX_SNAPSHOTS`, `LAYOUT.MAX_PINNED_GAMES`) to avoid drift. |
| `docs/realtime.md`                    | Removed the "two-tier transport" / three-bullet contradiction. Made it explicit that polling lives in the data-fetching hooks, not the realtime layer. Added a constants table sourced directly from `REALTIME` in `web/src/lib/config.ts` (failure threshold + window, SSE fallback duration, backoff range, recovery interval, freshness indicator). |
| `docs/env-and-config.md`              | (1) Removed the `FAIRBET.EV_TIER_STRONG / GOOD / MARGINAL` rows — those constants do not exist in `config.ts`. (2) Added the constants that **do** exist (`CONFIDENCE_SAMPLE_HIGH`, `CONFIDENCE_SAMPLE_MEDIUM`, `MONTE_CARLO_TRIALS`). (3) Expanded `API` to cover all fields (`FAIRBET_REQUEST_TIMEOUT_MS`, retry attempts/delay, `HEALTH_BACKEND_PING_TIMEOUT_MS`, `ISR_REVALIDATE_S`). (4) Added a new `Realtime` section (was missing entirely). (5) Filled in the missing `POLLING` entries (`READING_RESUME_DELAY_MS`, `TOKEN_REFRESH_MS`, `GOLF_*`). (6) Added the `FEATURE_GATES` keys that were missing from the doc but exist in code (`LINE_MOVEMENT`, `EV_SIMULATOR`, `CLV_TRACKING`, `WIN_PROBABILITY`, `HISTORY`). |
| `docs/testing.md`                     | Replaced the "Playwright-only" preamble with a two-layer description (Vitest + Playwright). Added the unit test catalogue (`tests/unit/ads/AdSlot.test.tsx`, `tests/unit/ads/shouldShowAds.test.ts`). Added the five Playwright test directories that exist on disk but were missing from the doc (`ads`, `freemium`, `nav`, `pwa`, `sync`). Added the four missing `npm` scripts (`test:smoke:pr`, `test:unit`, `test:unit:watch`, `test:unit:coverage`). |
| `docs/design.md`                      | Removed the "No unit tests. All testing is E2E via Playwright" claim — Vitest is wired up and `web/tests/unit/` has tests. Replaced with a two-layer description that matches `docs/testing.md`. |
| `docs/development.md`                 | Build path corrected to `.next/standalone/`. Added unit-test and Playwright-smoke scripts to the Commands table. |
| `docs/roadmap.md`                     | Deleted the entire "Research Index" section. The `docs/archived/research/` directory it pointed at does not exist in this repo. Phases themselves were not edited — they describe intent and exit criteria, not current code state, and remain code-grounded where they cite specific files (the `[x]` items all point at files that exist). |
| `docs/aidlc-futures.md`               | Already moved (see above). Internal pointers rewritten for the new depth: `docs/audits/...` → `audits/...`, `BRAINDUMP.md` → `../BRAINDUMP.md`, `README.md` → `../README.md`, `ARCHITECTURE.md`/`DESIGN.md`/`ROADMAP.md` references → `architecture.md`/`design.md`/`roadmap.md`. Audit list expanded from two to five (it had been omitting `security-report.md` and `ssot-report.md` and pointing at a doc-consolidation report that did not yet exist). |

## Statements removed because unverifiable

These were doc statements with no support in the current code or other docs.
Each was deleted, not annotated:

- `docs/architecture.md`: "open risk R-4 in security audit" — no R-4 marker exists in any audit report; the live tracker is `security-report.md` §J2.
- `docs/architecture.md`: implication that the `reveal` store persists under the `sd-read-state` localStorage key — only the migration source uses that key; the actual store is in IndexedDB.
- `docs/state-management.md`: same reveal-store mischaracterisation.
- `docs/env-and-config.md`: `FAIRBET.EV_TIER_STRONG / GOOD / MARGINAL` constants — not in `web/src/lib/config.ts`.
- `docs/design.md`: "No unit tests. All testing is E2E via Playwright" — false since `vitest` was added; `web/vitest.config.ts` and `web/tests/unit/` are live.
- `docs/realtime.md`: ambiguous "two-tier" / three-item enumeration that conflated polling-as-fallback with the realtime layer.
- `docs/roadmap.md`: 13-row Research Index — `docs/archived/research/` does not exist.
- `docs/README.md`: links to `abend-handling.md`, `security-audit.md`, `ssot-cleanup.md`, `archived/braindump.md`, `archived/research/`, and `../CLAUDE.md` — none of those files exist in the repo.
- `README.md` (root): same `CLAUDE.md` row deleted; build artefact path corrected.

## Statements *added* because they were verifiable from code but missing

- `useIsPro` hook, `game-core` store, `my-bets` store — all live in `web/src/`.
- Five Playwright test directories (`ads`, `freemium`, `nav`, `pwa`, `sync`) and the Vitest unit test catalogue.
- `web/public/ads.txt` static file (architecture.md ads paragraph).
- The full `REALTIME` constants table in `env-and-config.md`.
- The five additional `FEATURE_GATES` keys (`LINE_MOVEMENT`, `EV_SIMULATOR`, `CLV_TRACKING`, `WIN_PROBABILITY`, `HISTORY`).
- Three `FAIRBET` constants that did exist but were undocumented (`CONFIDENCE_SAMPLE_HIGH`, `CONFIDENCE_SAMPLE_MEDIUM`, `MONTE_CARLO_TRIALS`).
- Four `POLLING` constants that existed but were undocumented (`READING_RESUME_DELAY_MS`, `TOKEN_REFRESH_MS`, `GOLF_LEADERBOARD_REFRESH_MS`, `GOLF_TOURNAMENTS_REFRESH_MS`).
- Build path (`.next/standalone/`) and several `npm` test scripts that were live in `package.json` but missing from the docs.

## Intentional doc gaps left for future work

- **No CLAUDE.md and no plan to add one.** `docs/development.md` already covers
  setup + commands + common issues, and `docs/design.md` covers conventions.
  Adding a CLAUDE.md would just duplicate them. The references to it in
  `README.md` / `docs/README.md` were the only signal that it was supposed to
  exist — both have been removed.
- **No archived research directory and no plan to add one.** The roadmap
  research-index has been removed instead. If the underlying research surfaces
  again, restore the directory at the same time.
- **`/api/health` response detail.** Doc says it returns `{ status, timestamp }`
  with `"degraded"` on backend failure; the route is small enough that a
  fixture-style example would just duplicate the code. Left as-is.
- **`useFairBetOdds` / `lib/fairbet-utils.ts` size.** The cleanup report
  documents both as planned-but-deferred extractions; no need to repeat that
  in a public-facing doc.

## Escalations

These could not be resolved within the "Markdown only — no code refactors"
constraint of this pass. Each names the specific blocker, what would unblock
it, and the smallest concrete next action.

### E1 — `web/.env.local.example` documents the wrong default backend URL

- **Blocker**: the file is non-Markdown (env-config example), so this pass
  did not touch it. Strictly the comment is documentation, but acting on it
  would broaden scope beyond `docs/`.
- **Symptom**: line 6 says
  `default: https://sports-data-admin.dock108.ai`. The actual default in
  `web/src/lib/config.ts:7` is `BACKEND_BASE_URL = "https://sda.dock108.dev"`,
  and `web/src/lib/api-server.ts` uses that constant when
  `SPORTS_API_INTERNAL_URL` is unset. A new contributor copying
  `.env.local.example` and reading the comment will end up with a wrong
  mental model of the host.
- **Who unblocks**: anyone with merge access; this is a one-line comment fix.
- **Smallest concrete next action**: edit `web/.env.local.example:6` —
  replace `https://sports-data-admin.dock108.ai` with
  `https://sda.dock108.dev`. No code changes; commit alone.

### E2 — Stale `CLAUDE.md` reference in `web/src/components/layout/BottomTabs.tsx`

- **Blocker**: the file is `.tsx`, not Markdown. Same Markdown-only constraint
  as E1.
- **Symptom**: `web/src/components/layout/BottomTabs.tsx:62` contains the
  comment `// are admin-gated (see CLAUDE.md §Important Rules).` There is no
  `CLAUDE.md` in this repo. The rule that the comment refers to (admin-gating
  for analytics / history) is documented in `docs/architecture.md` §8 and
  `docs/roadmap.md` Phase 0 instead.
- **Who unblocks**: anyone with merge access; one-line comment fix.
- **Smallest concrete next action**: replace
  `(see CLAUDE.md §Important Rules)` with
  `(see docs/architecture.md §8 — Analytics Feature)` or simply delete the
  parenthetical. No code logic change.

### E3 — `web/public/ads.txt` is still a placeholder

- **Blocker**: filling it requires a live AdSense publisher ID, which is
  pending account approval; that is outside this pass's scope and outside
  `docs/`.
- **Symptom**: the file currently contains only two `#` comment lines
  describing the format. AdSense will reject ad serving until the file
  contains the real `google.com, pub-..., DIRECT, f08c47fec0942fa0` line.
  `docs/ADS_SETUP.md` already documents how to populate it.
- **Who unblocks**: whoever owns the AdSense account (publisher ID and the
  domain-add review).
- **Smallest concrete next action**: once AdSense approves the publisher
  ID, replace the placeholder per `docs/ADS_SETUP.md` § "ads.txt Setup".

### E4 — `STORY_QUALITY_GATE = true` keeps AI story infrastructure dormant

- **Blocker**: not a documentation issue — flipping the gate requires the
  50-story manual review described in `docs/architecture.md` §"AI Game Story"
  and `docs/roadmap.md` Phase 5. The docs already describe the gate and the
  exit criterion; nothing to add.
- **Smallest concrete next action**: when the review happens, flip the
  gate in `web/src/lib/config.ts` and re-verify the docs still match.

---

No bare TODOs were left in code or in markdown. Every finding above is either
a completed in-place edit, a verified deletion, an explicit "leave as-is"
with reason, or an escalation with a named blocker and a one-step next action.

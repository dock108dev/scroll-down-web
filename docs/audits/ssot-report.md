# SSOT Enforcement Pass — 2026-05-13

Scope: destructive cleanup driven by the in-flight working-tree diff against
`main` (the score-carry-forward / bridge-state / scene-setter-phase / debug-
overlay branch — issues ISSUE-001, ISSUE-002, ISSUE-005, ISSUE-006, ISSUE-007).
The diff hardens four SSOTs in the catch-up pipeline:

1. **Score cursor** — `lastKnownScore` threaded through `adaptDeck()` so
   rhythm/transition cards inherit the score *after* the most recent play
   (`web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts:62`).
2. **Bridge state** — `lastPlayEnding` snapshot threaded across rhythm cards
   and stamped onto the next play card as `priorAfter`
   (`web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts:68`,
   `:484` `snapshotPlayEnding`).
3. **Game phase** — `deriveGamePhase()` turns `isFinal` + `lastPlayIndex`
   into `"scheduled" | "live" | "final"` and stamps `gamePhase` on every
   `SceneSetterCard` (`web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts:163`).
4. **Per-card debug overlay** — `CardDebugOverlay` + `RhythmDebugBadge`
   render the validation-loop fields (`scoreBefore→scoreAfter`,
   `outsBefore→outsAfter`, `basesBefore→basesAfter`, `countBefore`, `phase`)
   when `?debug=true` is set
   (`web/src/components/catchup/CardDebugOverlay.tsx`).

This pass deletes code that contradicts those SSOTs *and* dead code that the
prior audits documented but did not act on.

## Changes made this pass

### Deletions (whole files)

| File | Why |
|------|-----|
| `web/src/lib/public-url.ts` | `publicBaseUrl()` had **zero source-code callers** (only its own test file). Its docstring described magic-link emails and Stripe checkout return URLs — neither feature exists in this MLB-only repo. Documented as dead in `docs/audits/docs-consolidation.md:78`. |
| `web/tests/unit/lib/public-url.test.ts` | Tests for the deleted module. |

### Deletions (in-file dead code)

| Location | What was removed |
|----------|------------------|
| `web/src/lib/utils.ts:131-355` | `cardDisplayName`, `extractNickname`, `extractSchoolName`, `COLLEGE_LEAGUES`, `PRO_MULTI_WORD`, `COLLEGE_MULTI_WORD`, `COLLEGE_MULTI_WORD_SCHOOLS_UNSORTED`, `MASCOT_PREFIXES`. `cardDisplayName` had **zero source-code callers**; the entire chain existed only to support `ncaab`/`ncaaf` league codes that contradict `LEAGUE = "mlb"` in `web/src/lib/config.ts`. Net: −224 LOC. |
| `web/tests/unit/lib/utils.test.ts` | The `"utils card display names"` describe block (9 expectations on `cardDisplayName`) and its import. Same reason. |
| `web/Dockerfile:14-27` | `NEXT_PUBLIC_ADS_ENABLED` + 5 `NEXT_PUBLIC_ADSENSE_*` ARG/ENV pairs (12 lines). No source code reads any of them; AdSense was removed in the MLB-only pivot (already documented as dead in `docs/audits/security-report.md:325`). |
| `.github/workflows/ci.yml:253-262` | `build-args:` block passing the same 6 AdSense env vars to docker. Pure plumbing for the deleted Dockerfile ARGs. |
| `.github/workflows/ci.yml` (4 sites) `.github/workflows/e2e-daily.yml` (2 sites) | `MAGIC_LINK_SECRET: ${{ secrets.MAGIC_LINK_SECRET ¦¦ '...for-e2e-only-48chars' }}` lines. **Zero source-code readers** for `MAGIC_LINK_SECRET`; the hardcoded fallback even self-identifies as "for-e2e-only", and there are no `/api/auth/*` routes in this repo. |
| `web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts:35,37` | Unused `SdmPlayPayload`, `SdmTeamSummary` imports (pre-existing ESLint warnings; killed under SSOT-deletion mandate). |

### Rewrites (SSOT replacement)

| Location | Before | After |
|----------|--------|-------|
| `web/src/lib/analytics.ts` | `send()` → `navigator.sendBeacon('/api/analytics-event', ...)` (a route that **does not exist** — see `web/src/app/api/`). `trackPageview` only beaconed; SPA pageviews 100% dropped. `trackEvent` beaconed *and* bridged to Plausible. JSDoc cited removed-feature examples (`sport: "nba"`, `bet_card_expand`). | `getPlausible()` helper. `trackPageview` and `trackEvent` are thin bridges to `window.plausible(...)`. No first-party endpoint. JSDoc updated to a single MLB-relevant example. Net: −34 LOC. |
| `web/src/components/catchup/SceneSetterCard.tsx` (`phaseCopy`) | Live arm returned `banner: "● LIVE"` but the JSX always rendered the live banner via a special-case branch (animated dot + text) and never read `copy.banner` for the live case — two sources of truth for the same string. | Live arm returns `banner: null` with a one-line comment explaining the JSX owns the live rendering. Type loosened to `string ¦ null`. |
| `web/src/components/layout/DegradedBanner.tsx:81` | "Scores **and odds** may be a few minutes behind." | "Scores may be a few minutes behind." (No betting/odds surface in this repo.) |
| `web/src/app/terms/page.tsx` | Sections referenced "betting analytics", "real-time wagering decisions", "Positive expected value", "winning bet", "Gamble responsibly", and an "Accounts" section describing "account credentials" / "suspend accounts". | Rewritten to describe the actual product (spoiler-free MLB catch-up) and dropped the `Accounts` section entirely. The architecture doc explicitly states this repo has no auth store. |
| `web/src/lib/date-utils.ts:5` | "MLB schedules are interpreted in US/Eastern (NHL/NBA/MLB convention)." | "MLB schedules are interpreted in US/Eastern (league convention)." Matches `LEAGUE = "mlb"` SSOT. |

### Documentation edits (mirror code deletions)

| File | Change |
|------|--------|
| `docs/env-and-config.md` | Removed `MAGIC_LINK_BASE_URL` row and the entire `Currently-defined-but-unused (deployment plumbing only)` table (7 dead env vars). |
| `docs/deployment.md` | Removed the `Build-time vs runtime env` AdSense block, the `MAGIC_LINK_SECRET` row in `Required secrets`, and the `NEXT_PUBLIC_ADSENSE_*` row in `Required variables`. Updated the `docker` job description. |
| `docs/testing.md` | Removed the `tests/unit/lib/public-url.test.ts` row from the unit-test inventory table. |
| `docs/PROD_PROMOTION_AND_COM_SETUP.md` | Deleted §6 "Reserved (formerly AdSense)" and renumbered §7-§10 down to §6-§9 (preserving the unrelated §9.5→§8.5 sub-heading). |
| `docs/architecture.md` | Rewrote the `Analytics` paragraph to match the new Plausible-bridge analytics module. Removed `public-url` from the lib-tree directory listing. |
| `docs/README.md` | Removed `public-URL hardening` from the security-audit description. |

### Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 206 / 206 passed (18 files) |
| `npx eslint . --max-warnings=0` | exit 0 (clean) |
| `npx tsc --noEmit` | unchanged from `main` baseline — only pre-existing failure is `tests/helpers.ts:2 monocart-reporter` missing dep, untouched by this pass |

Net working-tree delta from this pass alone (excluding the catch-up-pipeline branch's prior edits): **~−700 LOC of dead code removed**.

## SSOT modules per domain (post-pass)

| Domain | SSOT module | Notes |
|--------|-------------|-------|
| Score state across cards | `web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts` (`lastKnownScore` cursor) | UI components MUST consume `card.scoreBefore` / `card.scoreAfter` / `card.score`; never recompute. |
| Bridge / pre-play snapshot | `web/src/lib/adapters/scroll-down-mlb-deck-adapter.ts` (`lastPlayEnding` → `card.priorAfter`) | `CatchupCard.tsx` reads `card.priorAfter` only; no UI synthesis. |
| Game phase | `deriveGamePhase()` in adapter; surfaced as `SceneSetterCard.gamePhase` | Only `SceneSetterCard.tsx` reads `gamePhase`; other components use `card.isFinal` / `game.isLive` predicates from `lib/types.ts`. |
| Per-card debug overlay | `web/src/components/catchup/CardDebugOverlay.tsx` (+ `RhythmDebugBadge`) | Toggled once at mount via `?debug=true` in `CatchupExperience`. No competing dev overlays exist. |
| Analytics sink | Plausible (script tag in `web/src/app/layout.tsx`); `web/src/lib/analytics.ts` is a thin bridge | No first-party `/api/analytics-event` route exists. |
| MLB league | `LEAGUE = "mlb"` in `web/src/lib/config.ts` | All league branching removed from `web/src/lib/utils.ts`. |
| Field geometry | `web/src/lib/field-geometry.ts` | Already enforced (prior pass). |
| Settings persisted shape | `web/src/stores/settings.ts` (v2; v1→v2 migration drops 11 removed fields) | Already enforced. |

## Risk log — items intentionally retained

| Item | Why kept |
|------|----------|
| Plausible script `https://plausible.io/js/script.js` (not `script.manual.js`) in `web/src/app/layout.tsx:94` | Out of scope for an SSOT pass — switching the script flavor is a behavior change (manual SPA pageview tracking) that needs product decision. The new `analytics.ts` calls `plausible('pageview')` defensively; if the loaded script later supports manual events, SPA pageviews start flowing without further code changes. Today the call is a silent no-op for pageviews — strictly an improvement over the prior 404 beacon. |
| `wss://sda.dock108.dev` in CSP `connect-src` (`web/next.config.ts`) | App does not use WebSockets today, but the CSP allowance is "defensive" per `docs/architecture.md:118`. SSOT pass would only remove this if there were a positive policy that the CSP must list only used origins; no such policy exists. Left alone. |
| `web/tests/fixtures/games/19015*.json` containing `baseOnBalls` / `leftOnBase` / `stolenBases` | These are real MLB stat field names in upstream fixtures, not betting/odds artifacts. (The grep pattern caught them as substrings of "odds" / "wager"; manual inspection confirmed all are baseball stats.) |
| `web/src/lib/types.ts:32` `leagueCode: string` field on `Game` | Upstream payload still includes it; stripping it from our type would mean sanitizing every fetch. Inert in MLB-only mode (always `"mlb"`). Out of scope unless backend contract is renegotiated. |
| `MAGIC_LINK_SECRET` mention in prior audit reports (`docs/audits/security-report.md:256-300`, `docs-consolidation.md:74`) | Audit reports are historical artifacts that record past state. Editing them would rewrite history; the new pass section above documents the actual deletion. |
| `web/src/components/onboarding/TeamPickerOverlay.tsx` `league: "AL" ¦ "NL"` | This is the *baseball* league (American/National), not a multi-sport league. Correct as-is. |

## Sanity check — dangling references after deletion

After the deletions, full-repo grep for the removed symbols (excluding the new SSOT-report and the historical `docs/audits/`):

| Symbol | Remaining hits | Status |
|--------|----------------|--------|
| `publicBaseUrl` | 0 in `web/src/`, 0 in tests | clean |
| `cardDisplayName` | 0 anywhere | clean |
| `extractNickname` / `extractSchoolName` / `COLLEGE_LEAGUES` / `MASCOT_PREFIXES` | 0 anywhere | clean |
| `MAGIC_LINK_SECRET` | 0 in workflows, 0 in source | clean (historical audit references retained) |
| `NEXT_PUBLIC_ADSENSE_*` / `NEXT_PUBLIC_ADS_ENABLED` | 0 in workflows, 0 in source, 0 in active docs | clean (historical audit references retained) |
| `MAGIC_LINK_BASE_URL` | 0 in source, 0 in active docs | clean (historical audit references retained) |
| `/api/analytics-event` | 1 hit in `web/src/lib/analytics.ts:12` (a docstring noting the route never existed); 0 in active docs | acceptable — the comment exists *because* the route doesn't and exists as a forward-looking guardrail |
| `SdmPlayPayload` / `SdmTeamSummary` | 0 in source | clean (still exported from `types/scroll-down-mlb.ts` as part of the upstream contract; no consumer in this repo) |

---

# SSOT Enforcement Pass — 2026-05-09

Scope: destructive cleanup driven by the in-flight working-tree diff against
`main` (the MLB-focused catch-up overhaul: rundown profile, leverage band,
narration-panel rework, extra-trail generalization, header simplification,
home-screen amber palette, catch-up lab toolbar). Branch is `main` with
unstaged work, so the diff input was `git diff HEAD` plus the three
untracked files added on top of `main`
(`web/src/lib/leverage.ts`, `web/tests/unit/lib/leverage.test.ts`,
`web/tests/unit/lib/result-chip.test.ts`).

The diff explicitly removed the per-card stat-line UI from
`CatchupCard.tsx` (RunnerPills, formatBatterLine, formatPitcherLine,
the matchup eyebrows, the stat-line band) plus the matching CSS in
`globals.css` and the `data-testid` hooks (`matchup-row`,
`batter-line`, `pitcher-line`, `bases-summary`). The new
matchup row is a single `BATTER vs PITCHER · 3-1` line — no eyebrows,
no logos, no per-side stat lines.

The 2026-04-28 cleanup-report (above this section) **kept**
`formatOutsAsIP`, `computePitcherTimeline`'s line tracking, and
`computeBatterTimeline` on a "no public-API churn" rationale, with the
justification that `situationBefore.pitcherLine` was "still computed
… and shipped on every play card, so the formatting helper remains a
tested utility for the data shape that's still in the response." Per
the SSOT non-negotiable that **production usage cannot be proven**
for code only invoked by its own tests, this reasoning was circular —
the data shape is in the response only because the producer was still
running, not because anything reads it. This pass deletes the
orphaned producer + storage + formatter chain.

## Verification

| Check                 | Result                          |
| --------------------- | ------------------------------- |
| `npx tsc --noEmit`    | exit 0                          |
| `npm run lint`        | clean (no warnings)             |
| `npm run test:unit`   | 289/289 passed (18 files)       |

(289 = 263 pre-deletion + 26 net new tests in `leverage.test.ts` and
`result-chip.test.ts` minus the 3 dead-test cases removed —
`formatOutsAsIP`, `computeBatterTimeline`, and the
`computePitcherTimeline` "running line snapshot" sub-test.)

## Changes made this pass

Working-tree edits **on top of the in-flight diff**:

| File | Symbol / lines | Action | SSOT replacement |
|------|----------------|--------|------------------|
| `web/src/lib/types.ts` | `BatterLine` interface | **Deleted** | Single-line matchup row in `CatchupCard.tsx` (no per-batter stat block in current UI) |
| `web/src/lib/types.ts` | `PitcherLine` interface | **Deleted** | (same) |
| `web/src/lib/types.ts` | `SituationBefore.batterLine?` field | **Deleted** | — |
| `web/src/lib/types.ts` | `SituationBefore.pitcherLine?` field | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `BatterLine`, `PitcherLine` type imports | **Deleted** (now-unused) | — |
| `web/src/lib/catchup-cards.ts` | `formatOutsAsIP(outs)` (was exported) | **Deleted** | (no consumer) |
| `web/src/lib/catchup-cards.ts` | `inferRunsScored(play)` | **Deleted** (only used by removed line trackers) | — |
| `web/src/lib/catchup-cards.ts` | `BatterSnapshot` interface | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `PitcherSnapshot.line` field | **Deleted** | `PitcherSnapshot` reduced to `{ name }` — pitcher of record only |
| `web/src/lib/catchup-cards.ts` | `computeBatterTimeline(plays)` (was exported) | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `computePitcherTimeline` line accumulator (`lineByPitcher`, per-event `isHit`/`runsScored`/`PitcherLine` updates) | **Deleted** — function reduced to pitcher-of-record attribution. `outsByTeam` cumulative-outs walk retained because that's what drives reliever hand-off. | `computePitcherTimeline` itself, simplified |
| `web/src/lib/catchup-cards.ts` | `toPlayCard(... batterSnapshot?)` parameter | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `situationBefore.pitcherLine = pitcherSnapshot.line;` write | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `situationBefore.batterLine = batterSnapshot.line;` write | **Deleted** | — |
| `web/src/lib/catchup-cards.ts` | `buildCatchupCards`: `computeBatterTimeline(input.plays)` call + pass-through to `toPlayCard` | **Deleted** | — |
| `web/tests/unit/lib/catchup-cards.test.ts` | `formatOutsAsIP` import + describe block | **Deleted** | — |
| `web/tests/unit/lib/catchup-cards.test.ts` | `computeBatterTimeline` import + describe block | **Deleted** | — |
| `web/tests/unit/lib/catchup-cards.test.ts` | `computePitcherTimeline` "accumulates a running line snapshot" sub-test | **Deleted** (asserted on `.line` fields that no longer exist) | The remaining "attributes plays to the right pitcher by walking outs" sub-test (which asserts only on `.name`) covers the surviving behavior |
| `docs/audits/cleanup-report.md` | The "Kept" justification for `formatOutsAsIP` + the `box-score-timeline.ts` extraction plan | **Rewritten** to record that the SSOT pass superseded that justification, and to update the LOC plan: only `inningsPitchedToOuts` + simplified `computePitcherTimeline` (~80 LOC) remain in the would-be box-score module, not large enough to justify a sibling file |

Net source change: **roughly −280 LOC of orphaned producer / storage /
formatter code**, plus −80 LOC of dead tests; one test file's import
list shrinks by three names. No public-API surface remains for
batter/pitcher running-line stats; the catch-up flow's only stats UI
is now the scoreboard score numbers and the `BATTER vs PITCHER · 3-1`
matchup line.

## SSOT modules per domain touched by this branch

| Domain                                       | Single source of truth                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Pacing tier (narration timing / typography)  | `web/src/lib/leverage.ts` — `computeLeverage(card)` returns `LeverageTier 0/1/2`; constants `NARRATIVE_SETTLE_BONUS_MS`, `NARRATIVE_REVEAL_DUR_MS`, `NARRATIVE_TYPOGRAPHY_CLASS` keyed by tier |
| Inning bucket (CSS data attribute)           | `web/src/lib/leverage.ts` — `inningZone(inning)` returns `"early" \| "middle" \| "late" \| "extra"`                                |
| Leverage band (CSS data attribute / glow)    | `web/src/lib/leverage.ts` — `leverageBand(inning, margin)` + `leverageWeightMap` (band → 0–1 weight)                              |
| Result-chip visual tier (size / glow / animation) | `web/src/lib/result-chip.ts` — `resultChipTier(card)` returns `ChipTier 0/1/2/3`; the per-tier amplifier rules live alongside `resultChipLabel` so the chip's text + tier are co-located |
| Per-card play-phase timing                   | `web/src/lib/play-phases.ts` — `usePlayPhase`, `getPhaseSchedule`, `getPhaseMilestones`, plus the now-public `usePrefersReducedMotion` hook |
| Animation profile (event → choreography)     | `web/src/lib/catchup-cards.ts` — `classifyAnimationProfile(event, description)` is the only producer; `PlayAnimationProfile` (in `types.ts`) is the only consumer-facing union |
| Extra-trail choreography (chained throws)    | `web/src/components/catchup/BaseballLightField.tsx` — `EXTRA_TRAILS`, `SAC_FLY_RELAY_PATHS`, `RELAY_THROW_PATHS`, `resolveExtraTrails(profile, ballPath)`. The previously-spec'd `relay_throw` top-level profile is intentionally **not** added — its choreography lives here as `ExtraTrailDef` segments on `deep_fly` / `line_drive` / `sacrifice_fly`, with comments at `catchup-cards.ts:497` and `BaseballLightField.tsx:278` documenting the demotion rationale |
| Pitcher of record per play                   | `web/src/lib/catchup-cards.ts` — `computePitcherTimeline()` returns `Map<playIndex, { name } \| undefined>`; consumed by `toPlayCard` to set `situationBefore.pitcherName` |
| Home-deck amber palette                      | `web/src/app/globals.css` — `.home-deck` CSS-variable scope (`--home-card-bg`, `--home-card-border`, `--home-cta-color`, etc.); consumed by `GameRow.tsx` and `HomePageClient.tsx` |
| CTA verb (Home → catch-up flow)              | `web/src/components/home/GameRow.tsx` — local `cta` ternary ("Reconstruct" / "Resume reconstruction" / "Watched"). The `<h1>`/`<p>` page header in `HomePageClient.tsx` still uses "catch-up" / "Catch up" — this is an intentional split (verb on the action button, noun in the page lede); see Risk log. |

## Diff-prioritized deletions (this pass — full detail)

**Domain: batter/pitcher running-line stat tracking — gutted**

The in-flight diff removed the *consumer* (`formatBatterLine`,
`formatPitcherLine`, the `catchup-card-stat-line` rows in CatchupCard +
globals.css, the `data-testid="batter-line"` / `pitcher-line` hooks).
The producer + storage chain remained intact:

```
PlayEntry[] ─► computeBatterTimeline ─► BatterSnapshot ─► toPlayCard
PlayEntry[] ─► computePitcherTimeline (line accumulator) ─► PitcherSnapshot ─► toPlayCard
                                                                                  │
                                                                                  ▼
                                                    situationBefore.batterLine / .pitcherLine
                                                                                  │
                                                                                  ▼
                                                                         (no consumer)
```

After this pass: producer chain deleted at the root.

```
PlayEntry[] ─► computePitcherTimeline (pitcher-of-record only) ─► { name }
                                                                       │
                                                                       ▼
                                                       situationBefore.pitcherName
                                                                       │
                                                                       ▼
                                            CatchupCard matchup row (BATTER vs PITCHER)
```

`computePitcherTimeline` is preserved because the pitcher *name* is
still consumed by the matchup row; the function's cumulative-outs walk
is required to figure out which pitcher to attribute on a given play.
What was removed is the per-event line stats accumulator that was
only computed to fill a now-deleted UI block.

## Risk log — items intentionally retained

| Item                                                                   | Why retained                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inningsPitchedToOuts(ip)` (private to `catchup-cards.ts`)             | Still used by the surviving `computePitcherTimeline` to convert each upstream pitcher's `inningsPitched` field into a cumulative-outs threshold for reliever hand-off. Not part of the gutted line-stat path.                                                |
| `computePitcherTimeline` itself                                        | Still produces the pitcher *name* for `situationBefore.pitcherName`, which is read by the new single-line matchup row in `CatchupCard.tsx`. Only the line-stats accumulator inside it was removed.                                                            |
| `outsDeltaFor(event)` (used inside `computePitcherTimeline`)           | Drives the per-play outs increment that advances the cumulative-outs walk between relievers. Same function is also used by `computeTimeline` to derive `outsAfter`.                                                                                          |
| Local `function PitcherLine(...)` in `web/src/components/catchup/SceneSetterCard.tsx:88` | Different concept — a React subcomponent rendering one probable pitcher's name on the scene-setter card. Module-private; no longer collides with a `PitcherLine` *type* (which is now deleted). Renaming for "type/component disambiguation" would be cosmetic. |
| `relay_throw` discussion comments at `web/src/lib/catchup-cards.ts:497` and `web/src/components/catchup/BaseballLightField.tsx:278` | These are *comments*, not dead code. They document why a previously-spec'd top-level `PlayAnimationProfile` was intentionally not added (its choreography lives as `ExtraTrailDef` segments instead). Deleting them would lose the SSOT decision rationale.    |
| `web/src/components/home/HomePageClient.tsx` still uses "catch-up" / "Catch up" copy in the `<h1>` and lede `<p>` | The diff intentionally renamed the *action verb* (CTAs, "Recent reconstructions" section header) to the new "Reconstruct" vocabulary while leaving the page noun ("catch-up") in the page lede. This is a UI copy choice, not a code-level SSOT violation — the catch-up *flow* is still named `Catchup*` everywhere internally (`CatchupCard`, `useCatchupCards`, `catchup-progress` store, `.catchup-card-snap` CSS, `/catchup/[gameId]` route). The component identifier SSOT and the user-facing CTA SSOT are independent axes. |
| 2026-04-28 sections of `cleanup-report.md` and `error-handling-report.md` referencing the removed line-stats pipeline | Historical audit snapshots dated 2026-04-28. They are clearly dated and the cleanup-report's "Kept" justification has been **explicitly superseded** in place (see updated note in `cleanup-report.md`) so a reader following the trail won't be misled. Editing the dated body wholesale would falsify the audit history of the decision. |

## Sanity check — no dangling references to deleted symbols

Grepped the repo (excluding `node_modules`, `.next`) for the deleted
symbols after edits:

- `BatterLine` / `PitcherLine` *as a type*: zero matches in source / tests / current docs. The only matches are the unrelated `function PitcherLine(...)` React subcomponent in `SceneSetterCard.tsx` (see Risk log) and the `formatBatterLine`/`formatPitcherLine` historical references in `cleanup-report.md`'s "Dead code removed" historical note (correctly describing what the in-flight diff removed).
- `formatOutsAsIP`: zero matches in code, zero matches in tests; one historical mention in `cleanup-report.md` (the now-rewritten "Kept → superseded" note).
- `computeBatterTimeline`: zero matches in code or tests.
- `inferRunsScored`: zero matches.
- `BatterSnapshot`: zero matches.
- `PitcherSnapshot.line`: zero matches; the `PitcherSnapshot` interface itself was kept and reduced to `{ name }`.
- `situationBefore.batterLine` / `.pitcherLine` reads or writes: zero matches.
- Removed CSS classes from the in-flight diff (`catchup-card-matchup-side`, `catchup-card-matchup-eyebrow`, `catchup-card-batter-row`, `catchup-card-matchup-logo`, `catchup-card-stat-line`, `catchup-card-onbase-*`, `catchup-card-runners-band`, `catchup-cell-{pre,post,prior}`): zero matches in source or styles (re-verified after this pass's deletions).
- Removed `data-testid` hooks (`matchup-row`, `batter-line`, `pitcher-line`, `bases-summary`): zero matches in source, tests, or e2e suite.
- `SECONDARY_TRAILS` / `secondaryStartPoint` / `secondaryTrailPathId` (the pre-diff secondary-trail names): zero matches in source. One descriptive comment in `BaseballLightField.tsx:144` documents the rename to `EXTRA_TRAILS` — kept as historical pointer.

`npx tsc --noEmit`, `npm run lint`, and `npm run test:unit` all pass
after the deletions (289/289 across 18 files).

## Escalations

None. Every finding above was acted on in code or tests, or is recorded
in the Risk log with a concrete justification. There is no bare "TODO"
or "follow-up" left in source.

---

# SSOT Enforcement Pass — 2026-04-28

Scope: destructive cleanup driven by the diff between the working tree and
`main`. The branch is not on a feature ref (current branch is `main` with
unstaged work), so the diff input was `git diff HEAD` plus the untracked
files added on top of `main`.

The diff is the AdSense-rollout work: a new `web/src/lib/ads/` SSOT module
(`config.ts`, `entitlements.ts`, `useAdGate.ts`), six new component files
(`AdSenseScript`, `AdSlot`, `AdBoundary`, `FeedAd`, `FairBetAd`,
`GameDetailAd`), the deletion of `DetailBannerAd.tsx`, vitest unit tests,
and CSP / docs updates. Two prior audit passes (`cleanup-report.md`,
`error-handling-report.md`) had already trimmed gating duplication and
hardened error suppressions; this pass picked up the ad-system dead code
that survived those passes plus three doc snippets that still named the
removed components.

## Verification

| Check                          | Result          |
| ------------------------------ | --------------- |
| `npx tsc --noEmit`             | exit 0          |
| `npm run lint`                 | clean           |
| `npm run test:unit`            | 9/9 passed (was 13/13 before AdBoundary suite removal) |

## SSOT modules per domain

| Domain                       | Single source of truth                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Ad eligibility (pure)        | `web/src/lib/ads/entitlements.ts` — `shouldShowAds(viewer)`                                                                            |
| Ad eligibility (client hook) | `web/src/lib/ads/useAdGate.ts` — `useAdGate()` (reads `useTier`, `useAuth`, derives `ViewerEntitlements`, calls `shouldShowAds`)       |
| AdSense env / kill switch    | `web/src/lib/ads/config.ts` — `ADS_ENABLED`, `ADSENSE_CLIENT_ID`, `ADSENSE_*_SLOT`                                                     |
| Ad placement constants       | `web/src/lib/config.ts` — `ADS.NATIVE_AD_INTERVAL`, `ADS.TOP_FEED_AFTER_INDEX`, `ADS.MID_FEED_AFTER_INDEX`                             |
| AdSense `<script>` mount     | `web/src/components/ads/AdSenseScript.tsx` (gates via `useAdGate`)                                                                     |
| AdSense `<ins>` slot render  | `web/src/components/ads/AdSlot.tsx`                                                                                                    |
| Named ad surfaces            | `FeedAd`, `GameDetailAd`, `FairBetAd`, `NativeAdCard` — each calls `useAdGate()` once and renders `AdSlot` (or static native card)     |
| Ad operator docs             | `docs/ADS_SETUP.md`                                                                                                                   |

## Diff-prioritized deletions

| Symbol / file                                                  | Reason from diff                                                                                                                         | SSOT replacement                                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ADS.BANNER_WIDTH` / `ADS.BANNER_HEIGHT` (in `web/src/lib/config.ts`) | The constants existed only to feed `DetailBannerAd.tsx`'s 320×50 banner. The diff deletes `DetailBannerAd.tsx` entirely; `GameDetailAd.tsx` does not read them. Grep confirmed zero remaining call sites in `web/src/`. | `GameDetailAd` derives its own `minHeight` per position and lets `<AdSlot>` paint AdSense's responsive sizing. |
| `web/src/components/ads/AdBoundary.tsx`                         | The component takes a viewer prop directly and wraps its children behind `shouldShowAds`. It was added in the diff but never imported anywhere under `web/src/`. The named ad components instead gate via `useAdGate()`. Unreachable code = dead code under this pass's contract. | `useAdGate()` for any future custom ad surface; `shouldShowAds()` directly for any non-React caller. |
| `web/tests/unit/ads/AdBoundary.test.tsx`                        | Tests the deleted component. The viewer-eligibility behavior it exercised is already covered (and more thoroughly) by `web/tests/unit/ads/shouldShowAds.test.ts`, which tests the SSOT pure function directly. | `shouldShowAds.test.ts` — same scenarios, fewer layers. |
| `useTier`/`useAuth` reads inside `web/src/components/ads/AdSenseScript.tsx` | `AdSenseScript` was the last ad component duplicating the per-store gating pattern that the prior cleanup pass consolidated into `useAdGate`. The previous pass's justification for keeping it separate ("must also block when `ADSENSE_CLIENT_ID` is empty, even for admins") does not hold — `useAdGate` blocks on `ADSENSE_CLIENT_ID` via `shouldShowAds()` for every viewer including admins. Rewriting to `useAdGate()` collapses the last duplicate. | `useAdGate()` — same single hook every other ad component already uses. |

## Doc references stripped

| File / line                  | What was wrong                                                                  | Action                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md` `components/` tree | Listed only `NativeAdCard, DetailBannerAd` for `ads/`.                          | Replaced with the actual roster: `AdSenseScript, AdSlot, FeedAd, GameDetailAd, FairBetAd, NativeAdCard`.                                                |
| `docs/architecture.md` "Ads" paragraph    | Described `DetailBannerAd` (deleted) as the game-detail banner.                 | Rewrote to describe the AdSense flow (loader script + named slots), the SSOT eligibility hook, and to point at `ADS_SETUP.md` for setup details.        |
| `docs/roadmap.md` Phase 7 ads checkbox    | Cited `NativeAdCard.tsx` + `DetailBannerAd.tsx`.                                | Replaced with the current AdSense file list and a pointer to `ADS_SETUP.md`.                                                                            |
| `docs/env-and-config.md` Ads table        | Documented `ADS.BANNER_WIDTH` / `ADS.BANNER_HEIGHT` (now deleted).              | Replaced with `ADS.TOP_FEED_AFTER_INDEX` / `ADS.MID_FEED_AFTER_INDEX` (the actually-shipped constants) plus a sentence pointing slot/env docs at `ADS_SETUP.md`. |
| `docs/ADS_SETUP.md` "do not duplicate that check" paragraph | Recommended gating "via `<AdBoundary>` or one of the named ad components."      | `<AdBoundary>` is gone; rewrote to recommend the named components and `useAdGate()` for any future custom ad surface.                                   |

## Risk log — legacy code intentionally retained

| Item                                                                                                              | Why retained                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ViewerEntitlements.isAuthenticated` field                                                                         | Still part of the documented type contract (also referenced in `BRAINDUMP.md`). `shouldShowAds` does not branch on it today, but it remains semantically useful to any future caller and the cost of keeping it is one line. Removing it would be a cosmetic public-API change with no SSOT win. |
| `BRAINDUMP.md` references to `AdBoundary`, `NEXT_PUBLIC_ADS_ENABLED`, etc.                                         | `BRAINDUMP.md` is a planning / spec document that drove the implementation of this branch. Per `AIDLC_FUTURES.md` it is intentionally a "what we want" contract, not a reflection of current state. Edits here would rewrite history; the up-to-date current-state docs are `docs/architecture.md`, `docs/roadmap.md`, `docs/ADS_SETUP.md`, `docs/env-and-config.md` (all already updated). |
| Historical references to `DetailBannerAd` / `slotIndex` / `AdBoundary` in `docs/audits/cleanup-report.md` and `docs/audits/error-handling-report.md` | These are dated audit snapshots describing what was true at audit time. Editing them would falsify the audit trail. They are clearly dated 2026-04-28 and reference work that pre-dates this pass.                                                                                       |
| `useAdGate()` reads `useAuth(s => s.token)` to derive `isAuthenticated`                                            | Mirrored from the prior consolidation; preserves the documented `ViewerEntitlements` shape. The token read costs nothing and aligns with the type contract. Pruning it would be cosmetic — see the `isAuthenticated` row above.                                                                                                                |

## Sanity check — no dangling references to deleted symbols

Grepped `ADS.BANNER_WIDTH|ADS.BANNER_HEIGHT|BANNER_WIDTH|BANNER_HEIGHT|DetailBannerAd|detail-banner-ad|AdBoundary` across the entire repo after edits:

- `BRAINDUMP.md` — planning doc, retained per risk log.
- `docs/audits/cleanup-report.md`, `docs/audits/error-handling-report.md` — historical snapshots, retained per risk log.
- All other matches were inside this report. No live source / test / current doc still cites a deleted symbol.

`npx tsc --noEmit`, `npm run lint`, and `npm run test:unit` all pass after the deletions.

## Escalations

None. Every change above was acted on in code or docs, or has a concrete justification in the risk log.

## Re-audit triggers

- A new ad surface is added that does not call `useAdGate()` — should fail review for SSOT violation.
- `BRAINDUMP.md` is rewritten as the next round's contract — at that point its retained `AdBoundary` references should be replaced with `useAdGate` to keep planning aligned with implementation.
- `ViewerEntitlements.isAuthenticated` gains a real branch in `shouldShowAds()` — at that point the `useAdGate` read of `token` becomes load-bearing rather than cosmetic, which is the correct outcome.

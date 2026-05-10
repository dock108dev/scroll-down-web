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

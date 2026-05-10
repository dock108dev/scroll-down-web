# Cleanup Pass — 2026-05-09

Narrow follow-up on the in-flight catchup-card diff (MLB-focused overhaul:
rundown profile, leverage-driven visuals, narration-panel rework, extra-trail
generalization, header simplification). Earlier MLB-era cleanup work is
prepended below for traceability — the FairBet/golf-era pass at the bottom
of this file is retained for historical context only; those modules no
longer exist in this repo.

Verification commands run on completion:

| Check                | Result                |
| -------------------- | --------------------- |
| `npx tsc --noEmit`   | exit 0                |
| `npm run lint`       | clean (exit 0)        |
| `npm run test:unit`  | 289/289 passed (18 files) |

## Changes made this pass (second sub-pass — 2026-05-09 PM)

Followup audit after the SSOT pass landed. Targets: dead transport in the
catchup-card pipeline that the SSOT deletion exposed, dead branch in the
new `leverageBand`, and FairBet-era CSS/TS leftovers that the MLB overhaul
left behind.

| File | What changed | Disposition |
|------|--------------|-------------|
| `web/src/lib/catchup-cards.ts` | Deleted the `UpstreamBatter` interface and the `mlbBatters?: UpstreamBatter[]` field on `BuildCardsInput`. The SSOT pass removed `computeBatterTimeline` (the only consumer); both API routes were still piping `data.mlbBatters` through to `buildCatchupCards`, where it was silently dropped. | **Acted (delete)** |
| `web/src/lib/catchup-cards.ts` | Reordered imports — value imports (`config`, `narrative`, `rhythm-planner`) were sandwiched between two halves of the type-import block by an earlier edit; consolidated to one type-import block followed by one value-import block. | **Acted (consistency)** |
| `web/src/app/api/games/[gameId]/cards/route.ts` | Dropped the `UpstreamBatter` type import, the `mlbBatters?` field on `UpstreamGameDetail`, and the `mlbBatters: data.mlbBatters` argument to `buildCatchupCards`. | **Acted (delete)** |
| `web/src/app/api/dev/fixtures/[id]/cards/route.ts` | Same three deletions — type import, fixture-shape field, and `buildCatchupCards` argument. (Fixture JSON files retain `mlbBatters` blocks; TypeScript ignores excess fields, no fixture rewrite needed.) | **Acted (delete)** |
| `web/src/lib/leverage.ts:39` (`leverageBand`) | Removed `if (inning >= 10 && margin <= 2) return "critical";` — strict subset of the next line `if (inning >= 9 && margin <= 2) return "critical";`, so it never fired. Behavior unchanged; the existing test `leverageBand(10, 0) === "critical"` still passes via line 40. | **Acted (delete)** |
| `web/src/lib/theme.ts` | Deleted the entire file. Exports (`FairBetTheme`, `bookAbbreviation`, `bookSlug`, `BOOK_ABBREVIATION_MAP`) had zero importers anywhere under `web/src` or `web/tests` — pure FairBet/golf-era leftover. | **Acted (delete)** |
| `web/src/app/globals.css` (light + dark `:root`) | Deleted the `--fb-*` and `--ev-good-text` design-token blocks (28 vars total). No `var(--fb-*)` or `var(--ev-good-text)` consumer anywhere in the repo. Updated the file-header comment from "Maps to iOS DesignSystem / GameTheme / FairBetTheme exactly." to "Maps to iOS DesignSystem / GameTheme exactly." | **Acted (delete)** |
| `web/src/app/globals.css` (`.scroll-fade-top`, `.scroll-fade-bottom`) | Deleted both classes and their wrapper section comment. Defined-but-not-applied: zero `className` consumers in any `.tsx`/`.ts`/`.html`. | **Acted (delete)** |
| `web/src/app/globals.css` (scroll-padding section comment) | Rewrote the comment, which referenced `the FairBet sticky filter bar (which is ≈350px tall on mobile in pro view) or the BottomTabs` — both removed by the MLB overhaul — to just describe the surviving sticky-header use case. The `html { scroll-padding-* }` rule itself is unchanged. | **Acted (consistency)** |

No behavioral changes anywhere. All deletions are dead code as confirmed
by grep + the green test/lint/tsc baseline.

## Changes made this pass (first sub-pass — 2026-05-09 AM)

| File | What changed | Disposition |
|------|--------------|-------------|
| `web/src/components/catchup/BaseballLightField.tsx:996` (`RunnerDotSvg`) | Replaced predicate-alias narrowing (`const isOut = movement.to === "out"; const destination = isOut ? movement.outAt! : movement.to;`) with the inline check `movement.to === "out" ? movement.outAt! : movement.to`. TypeScript can't track narrowing through a boolean alias, so the prior code typed `destination` as `BaseName \| "out"` and tripped a TS error against `basepathSvgPath(BaseName, BaseName)`. The `isOut` alias is preserved for the `data-testid` / `data-to` reads further down. | **Acted (tighten)** |

## Dead code removed

See the table above. Survey notes (carryover from the morning sub-pass):

- The in-flight diff already removed the dead per-card stat-line UI
  (`formatBatterLine`, `formatPitcherLine`, `RunnerPills`, `lastNameOnly`,
  `describeRunnerSlots`, `serializeSlots`, `RunnerSlot`) from
  `web/src/components/catchup/CatchupCard.tsx` and the matching CSS
  rules from `globals.css`. Verified there are zero remaining references
  to `catchup-card-matchup-side`, `catchup-card-matchup-eyebrow`,
  `catchup-card-batter-row`, `catchup-card-matchup-logo`,
  `catchup-card-stat-line`, `catchup-card-onbase-*`,
  `catchup-card-runners-band`, or `catchup-cell-{pre,post,prior}` in
  either source or styles.
- `formatOutsAsIP` (`web/src/lib/catchup-cards.ts:1185`) was exported
  and imported only by its own test. The CatchupCard pitcher-line
  display that used to consume it was removed by the in-flight diff,
  leaving the entire batter/pitcher running-line pipeline orphaned
  (producer + storage shipping on every play card with no consumer).
  Originally **Kept** by this pass on a "no public-API churn" rationale —
  **superseded by the SSOT pass on the same date**, which correctly
  identified the pipeline as dead under SSOT non-negotiables and
  removed `formatOutsAsIP`, `computeBatterTimeline`, `inferRunsScored`,
  `BatterSnapshot`, `PitcherLine`, `BatterLine`, the
  `pitcherLine`/`batterLine` fields on `SituationBefore`, and the
  line-tracking accumulator inside `computePitcherTimeline`. See
  `docs/audits/ssot-report.md` for the full deletion log. The
  follow-up plan to extract `box-score-timeline.ts` from
  `catchup-cards.ts` (referenced in **Files still >500 LOC** below)
  no longer applies — that subgroup has been gutted; the function
  count to extract is now `inningsPitchedToOuts` +
  `computePitcherTimeline` (pitcher attribution only, ~80 LOC).
- The `relay_throw` profile (originally specced as a top-level
  `PlayAnimationProfile`) was already justified-in-place by the in-flight
  diff: see the comment at `catchup-cards.ts:497-503` and
  `BaseballLightField.tsx:278-283`. Demoted to two `ExtraTrail` segments
  on `deep_fly` / `line_drive`; no orphaned classifier branch.

## Files refactored / split

None this pass. The deletions and the narrowing fix were drop-ins; no
public API changed beyond the removal of the unused `UpstreamBatter`
type re-export from `@/lib/catchup-cards` (no consumers).

## Files still >500 LOC

| File | LOC | Outcome |
|------|-----|---------|
| `web/src/lib/catchup-cards.ts` | ~1880 (post-SSOT pass) | **Plan.** Two clean seams for a follow-up pass: (a) `play-classification.ts` — `classifyEvent`, `ballPathFromEvent`, `classifyAnimationProfile`, the `EVENT_KEYWORDS` / `DIRECTION_*` / `FIELDER_*` / `DESC_*` regex tables, and the inning-zone helpers (~330 LOC); (b) `runner-resolution.ts` — `predictAdvances`, `diffAdvances`, `mergeParsedAdvances`, `parseDescriptionAdvances`, `applyRunConstraint`, `applyAdvances`, `applyRunnerNames`, plus `RE_SCORES` / `RE_TO_BASE` / `RE_OUT_AT` patterns (~400 LOC). The original third seam (`box-score-timeline.ts`) was gutted by the SSOT pass — only `inningsPitchedToOuts` + `computePitcherTimeline` (~80 LOC, pitcher attribution only) remain and are not large enough to justify a sibling file. Each remaining subgroup is internally cohesive and has no upstream callers besides the deck-builder pipeline (`computeTimeline` → `selectPlays` → `buildCatchupCards`), which would stay in this file. Deferred to keep this pass scoped to the in-flight diff. |
| `web/src/components/catchup/BaseballLightField.tsx` | 1360 | **Plan.** Three siblings under `web/src/components/catchup/field/`: (a) `runner-elements.tsx` — `RunnerDotSvg`, `RunnerTrailSvg`, `BallDot` (~400 LOC); (b) `base-elements.tsx` — `BaseShape`, `BaseBulb`, `BaseLabel`, `BaseLabelText`, `compactLabel`, `labelFontSize`, plus the `Lifecycle` type (~160 LOC); (c) `animation-config.ts` — `PROFILE_GLOW`, `DOT_RADIUS`, `DOT_OPACITY`, `TRAIL_WIDTH`, `STYLE_DOT_CLASS`, `EXTRA_TRAILS`, `SAC_FLY_RELAY_PATHS`, `RELAY_THROW_PATHS`, `resolveExtraTrails`, `extraTrailStartPoint`, `ExtraTrailDef` (~280 LOC). The main shell would land at ~520 LOC, still over budget but with the high-churn animation/runner code isolated. The new `rundown` profile + `EXTRA_TRAILS` array makes the timing for these subgroups stable enough that a follow-up split won't immediately need re-tuning. |

Files between 400 and 500 LOC (`types.ts` 496, `rhythm-planner.ts` 445,
`dev/catchup-lab/page.tsx` 404, `CatchupCard.tsx` 413) all sit just below
the threshold; left as-is.

## Consistency edits

| File | Change |
|------|--------|
| `web/src/components/catchup/BaseballLightField.tsx` | Inline-narrowed `destination` in `RunnerDotSvg` (typing fix only — see Changes). |
| `web/src/lib/catchup-cards.ts` | Reordered imports so all type imports precede all value imports (was split by the SSOT-era edit). |
| `web/src/app/globals.css` (header comment) | Removed `FairBetTheme` from the design-token mapping comment. |
| `web/src/app/globals.css` (scroll-padding comment) | Replaced FairBet/BottomTabs reference with a generic sticky-header rationale. |

## Escalations

None. Every finding above was acted on or justified in place. The two
files still >500 LOC are tracked under **Plan** with concrete extraction
seams for the next pass.

---

# Cleanup Pass — 2026-04-28

Scope: dead code, stale comments, file-size review, duplicate utilities.
This is the second cleanup pass on 2026-04-28; it ran on top of the
ad-component consolidation already documented below and after the
error-handling and security audits landed. No behavioral changes;
build, type check, lint, and unit tests all pass after the pass.

> **Note (added 2026-05-09):** the entries below reference FairBet, golf,
> Monte Carlo, NBA/NHL/NCAAB modules that were removed in the MLB-focused
> overhaul. Retained for historical traceability of decisions; do not use
> as a current map of the repo.

Verification commands run on completion:

| Check                    | Result          |
| ------------------------ | --------------- |
| `npx tsc --noEmit`       | exit 0          |
| `npm run lint`           | clean (exit 0)  |
| `npm run test:unit`      | 9/9 passed      |

## Summary

The repo is in good shape — no `TODO`/`FIXME`/`XXX`/`HACK` markers anywhere
under `web/src`, no commented-out code blocks, and no obvious stale
comments after the recent error-handling, security, and ads-rollout work.
This pass surfaced two genuinely-unused exported helpers in
`fairbet-utils.ts` (held over from a never-shipped client-side EV/devig
path) and the type that backed one of them; everything else flagged
either turned out to be live (cross-file usage the survey missed) or
intentional structured-logging.

## Dead code removed

| Location                                                     | What                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/lib/fairbet-utils.ts` (~30-48, prior numbering)     | Removed `EV_NO_EDGE_THRESHOLD` const + `formatEVDollars()` function. Exported but with no importers anywhere in `web/src`/`web/tests` — the live formatter is `formatEV()`.            |
| `web/src/lib/fairbet-utils.ts` (~465-488, prior numbering)   | Removed the `devig()` function. No call sites; "no-vig devig" math is performed on the backend, not the client. The internal `americanToImpliedProb`/`impliedProbToAmerican` helpers it relied on are still used by `legFairProb`, `enrichBet`, and `closingLineValue`. |
| `web/src/lib/fairbet-utils.ts:12`                            | Trimmed `DevigedMarket` from the type import — orphaned by the `devig()` removal.                                                                                                     |
| `web/src/lib/types.ts` (~592-602, prior numbering)           | Removed the `DevigedMarket` interface itself — only `devig()` referenced it.                                                                                                          |

Net delta: ~38 lines removed, no behavioral change. Verified by
re-running `tsc --noEmit` and `npm run lint`.

### Findings investigated and rejected

| Finding                                                                          | Decision                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calcSpreadOutcome`, `calcTotalOutcome`, `calcMoneylineOutcome` flagged as unused | **Live.** All three are imported and called in `web/src/components/game/OddsTable.tsx:8-10,260-265`.                                                                                                                                                       |
| `EVDiagnostics`, `ExplanationStep` types flagged as unused                       | **Live.** Both are referenced as the types of optional fields on `BetsResponse.ev_diagnostics` and `APIBet.explanation_steps` (`web/src/lib/types.ts:527,573`).                                                                                              |
| `console.log` calls in `api/ai/story/route.ts`, `api/story-feedback/route.ts`, `api/analytics-event/route.ts` | **Intentional.** Per `docs/architecture.md` ("Self-hosted analytics. Logs structured JSON to stdout (Docker captures)"), these are the structured-logging path — Docker's stdout capture is the SSOT for analytics events. Removing them would silently disable analytics ingestion. |

## Files refactored / split

None. The two deletions were drop-in; no public API changed.

## Duplicates consolidated

None new. The ad-component gating consolidation from the earlier pass on
the same day (see archived block below) covers the only duplication that
landed on this branch.

## Files still >500 LOC

After this pass, post-deletion line counts:

| File                                              | LOC | Outcome                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/lib/types.ts`                            | 720 | **Justify.** Single source of truth for shared API/domain types. Already organized into clearly delimited sections (`Enums`, `Game List`, `FairBet`, `Golf`, `Helpers`). Splitting would force every consumer to discover N new import paths with no semantic gain. (This pass dropped 12 LOC by removing the unused `DevigedMarket` type.) |
| `web/src/hooks/useFairBetOdds.ts`                 | 698 | **Plan.** One cohesive data-fetching hook (paging, cache, filters, parlay state). A clean split would extract: (a) a `useFairBetCache` helper for in-memory + localStorage seeding (~50 LOC), and (b) a `useFairBetParlay` sub-hook for parlay state (~100 LOC). Defer to a follow-up pass — low confidence the split keeps the same render-stable behavior without test coverage of the hook. |
| `web/src/lib/fairbet-utils.ts`                    | 599 | **Plan.** Module already grouped with section comments (Formatting / EV / Confidence / Market labels / Selection display / Enrichment / Parlay). Next pass: extract `parlay-utils.ts` (legFairProb, parlayProbIndependent, hasCorrelatedLegs, parlayConfidenceTier; ~120 LOC) — they're a self-contained subgroup with no upstream/downstream coupling. (Down 45 LOC after this pass — `formatEVDollars`, `EV_NO_EDGE_THRESHOLD`, and `devig` removed.) |
| `web/src/components/fairbet/LiveOddsPanel.tsx`    | 548 | **Plan.** Extract the ~100-LOC `LiveOddsBetCard` inner subcomponent (the card-renderer in the bet list) into `LiveOddsBetCard.tsx`. The current panel mixes the data-loading / sort / filter shell with card rendering; the card is the obvious seam. |
| `web/src/app/game/[id]/page.tsx`                  | 542 | **Justify.** Already heavily decomposed — every section (`PlayerStatsSection`, `OddsSection`, `WrapUpSection`, etc.) is a separate component. The page body is a thin orchestration layer of section toggles, refs, and intersection observers; splitting further would scatter related state and hurt traceability. |
| `web/src/app/page.tsx`                            | 527 | **Justify.** Same shape as `game/[id]/page.tsx`: thin orchestration over `TimelineSection`/`SearchBar`/`RevealHero`/etc. The remaining bulk is the toolbar JSX (sticky league pills + icon buttons), which is page-specific UI with no reuse opportunity. |
| `web/src/components/fairbet/MonteCarloSheet.tsx`  | 523 | **Plan.** A bottom-sheet modal containing the Monte Carlo simulation UI. Next pass: extract the inner `MonteCarloChart` and `MonteCarloSummary` subcomponents (each ~80-120 LOC) into siblings under `components/fairbet/montecarlo/`. The state is already local to the sheet; the children are pure presentational. |
| `web/src/lib/salient-events.ts`                   | 509 | **Justify.** Pure logic module that classifies play-by-play events into salient narrative beats. The bulk is sport-by-sport classification tables (MLB / NBA / NHL / NCAAB) that are inherently long but mechanically structured. Splitting per sport would produce four ~100-LOC files plus a router and add no clarity for code readers. |

## Consistency changes made

None this pass — the deletions were self-contained and surrounding style
already matched. Sibling section structure in `fairbet-utils.ts` was
preserved (the `// ── Formatting ──` block now contains only `formatEV`
and `formatProbability`, which is fine — the comment header still
labels the section accurately).

## Escalations

None. Every finding above was either acted on or justified in place. The
"Files still >500 LOC" entries marked **Plan** are concrete, scoped
extraction proposals for the next pass — not bare TODOs — and the
**Justify** entries explain why the file legitimately needs its size.

---

## Earlier pass — same day, ad-component consolidation

(retained for traceability; the ad-gate hook this introduced is the
home referenced by `useAdGate()` in the components below.)

### Dead code removed

| Location                                                     | What                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `web/src/components/ads/NativeAdCard.tsx`                    | Removed `slotIndex` prop and the underscored `_slotIndex` parameter — passed but never read.                |
| `web/src/components/home/TimelineSection.tsx:189-197`        | Removed the `slotIndex={Math.floor(...)}` math at the call site since the prop is gone.                     |
| `web/src/components/ads/{NativeAdCard,FairBetAd,FeedAd,GameDetailAd}.tsx` | Removed four copies of the `useTier`/`useAuth` reads + manual `ViewerEntitlements` construction (now in `useAdGate`). |

The previous pass already deleted `web/src/components/ads/DetailBannerAd.tsx`
(replaced by `GameDetailAd`); no other references remain.

### Duplicates consolidated — ad-component viewer-entitlement gating

**Before:** four ad components each repeated the same 10-line block:

```ts
const tier = useTier((s) => s.tier);
const initialized = useTier((s) => s.initialized);
const role = useAuth((s) => s.role);
const token = useAuth((s) => s.token);
if (!initialized) return null;
const viewer: ViewerEntitlements = {
  isAuthenticated: token !== null && role !== "guest",
  isAdmin: role === "admin",
  isPaid: tier === "pro",
};
if (!shouldShowAds(viewer)) return null;
```

**After:** consolidated into `web/src/lib/ads/useAdGate.ts` (canonical
home, alongside `entitlements.ts` and `config.ts`). Each component now uses:

```ts
const gateOpen = useAdGate();
if (!gateOpen) return null;
```

Updated callers:

- `web/src/components/ads/NativeAdCard.tsx`
- `web/src/components/ads/FairBetAd.tsx`
- `web/src/components/ads/FeedAd.tsx`
- `web/src/components/ads/GameDetailAd.tsx`
- `web/src/components/ads/AdSenseScript.tsx` (also migrated; the
  `ADSENSE_CLIENT_ID === ""` short-circuit is preserved by
  `shouldShowAds()` itself, which checks the client id alongside
  `ADS_ENABLED`).

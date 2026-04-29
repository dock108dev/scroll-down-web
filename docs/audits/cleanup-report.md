# Cleanup Pass — 2026-04-28

Scope: dead code, stale comments, file-size review, duplicate utilities.
This is the second cleanup pass on 2026-04-28; it ran on top of the
ad-component consolidation already documented below and after the
error-handling and security audits landed. No behavioral changes;
build, type check, lint, and unit tests all pass after the pass.

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

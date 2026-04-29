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

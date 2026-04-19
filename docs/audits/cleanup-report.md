# Code Quality Cleanup Report

**Date**: 2026-04-18  
**Branch**: aidlc_1  
**Scope**: `web/src/` — dead code, documentation in code, consistency, file size, duplicate utilities

---

## Dead Code Removed

### `web/src/lib/fairbet-utils.ts`

**`EV_NO_EDGE_THRESHOLD`** — Removed `export`. The constant had zero external importers; only used internally by `formatEVDollars`. Making it module-private removes it from the public API.

**`isConfidenceReliable`** — Removed `export`. Had zero external importers; only called internally by `isReliablyPositive`.

**`impliedProbFromAmerican`** — Removed entirely. Was a one-line wrapper (`return americanToImpliedProb(odds)`) with zero importers — not used anywhere outside the file. Callers should use `americanToImpliedProb` directly (already exported).

No other dead exports, commented-out blocks, or `TODO`/`FIXME`/`HACK` annotations were found. All remaining exports in `lib/`, `hooks/`, `stores/`, and `realtime/` are imported by at least one consumer.

---

## Bugs Fixed

### TypeScript error — `web/src/app/api/billing/webhook/route.ts`

`sub.current_period_end` was removed from the top-level `Stripe.Subscription` type in Stripe SDK v22 (it moved to `SubscriptionItem`). The code compiled with `skipLibCheck: true` in tsconfig but failed under `tsc --noEmit`. Fixed to use `sub.items.data[0]?.current_period_end`.

### TypeScript errors — test files using complex generic inference

Two test files used `Parameters<Parameters<typeof test>[1]>[0]["field"]` to extract fixture types, which TypeScript could not resolve. Fixed with direct type imports:

- `tests/game/salient-events.spec.ts`: import `APIRequestContext` from `@playwright/test`
- `tests/game/team-stats.spec.ts`: import `Page` from `@playwright/test`

`tsc --noEmit` now exits clean (was 35 errors, all in these two files plus the webhook route).

---

## Refactors Made

### 1. Back button deduplication — `web/src/app/game/[id]/page.tsx`

The mobile back button JSX was written identically three times across loading, error, and main render paths. Extracted to a `const backButton`. No behavioral change.

**Before**: ~36 lines of duplicated JSX  
**After**: 9-line const + three `{backButton}` references

### 2. Intermediate variable removal — `web/src/app/game/[id]/sections.ts`

`hasPregamePosts` was computed only to feed `hasBuzz = !!hasPregamePosts`. Collapsed into one declaration:

```typescript
// before
const hasPregamePosts = isAdmin && data.socialPosts?.some(...);
const hasBuzz = !!hasPregamePosts;

// after
const hasBuzz = !!(isAdmin && data.socialPosts?.some(...));
```

### 3. Extra blank line — `web/src/components/home/GameRow.tsx`

Removed stray double blank line between interface and function definition.

---

## Files Over 500 LOC

| File | Lines | Justification |
|------|-------|---------------|
| `src/lib/types.ts` | 702 | Single-source-of-truth for all API response types per CLAUDE.md rule 6. Expected to be large. |
| `src/hooks/useFairBetOdds.ts` | 695 | Orchestrates multi-page concurrent fetch, abort/retry, parlay state, filter state, and realtime subscription — all tightly coupled. Splitting would scatter the abort controller and cache invalidation logic. |
| `src/lib/fairbet-utils.ts` | 636 | FairBet domain utilities: formatting, EV classification, selection display, parlay math, bet enrichment. Cohesive domain boundary. Natural future seam: extract `odds-math.ts` for the probability/devig functions. |
| `src/components/fairbet/BetCard.tsx` | 626 | Complex card with free/pro conditional rendering, log-bet modal state, and book comparison. |
| `src/app/game/[id]/page.tsx` | 532 | Game detail page orchestrates ~10 collapsible sections, realtime subscription, reading-position save/restore, and IntersectionObserver for section nav. High inherent complexity. |
| `src/components/fairbet/MonteCarloSheet.tsx` | 510 | Simulation-heavy component. Math could move to a separate utility if extracted further. |
| `src/lib/salient-events.ts` | 509 | Full salient-event extraction pipeline for MLB/NBA/NHL/NFL. Sport-specific rule tables belong together. |
| `src/app/fairbet/page.tsx` | 504 | FairBet page managing filters, grouping, and progressive rendering. |

None flagged for required follow-up — size reflects real domain complexity. If `fairbet-utils.ts` continues to grow, extracting `odds-math.ts` is the logical next step.

---

## Documentation Issues Found (Not Changed)

**Missing `web/.env.local.example`** — `CLAUDE.md` and `README.md` both document `cp .env.local.example .env.local` but the file does not exist in the repo (the `web/.gitignore` pattern `.env*` excludes it). The required variables are documented in `docs/env-and-config.md`. A `.env.local.example` with commented-out stubs would make onboarding functional.

---

## Consistency Observations

All files follow CLAUDE.md conventions without exception:

- **Naming**: PascalCase components, kebab-case stores/libs, `use` prefix hooks, `SCREAMING_SNAKE_CASE` constants — 100% compliant across all 243 files.
- **Imports**: No `import React` statements (new JSX transform in use throughout). No `any` types or `@ts-ignore`.
- **ESLint disables**: All `eslint-disable` comments have explanatory text.
- **Config constants**: All magic numbers live in `src/lib/config.ts`. No scattered literals found.
- **API access**: No direct calls to `sda.dock108.dev` from client code — all proxied through `src/app/api/`.
- **Console logging**: `console.log` in API routes (`/api/ai/story`, `/api/analytics-event`, `/api/story-feedback`) is intentional structured stdout logging captured by Docker — not debug output.

---

## Duplicate Utilities

No duplicated logic found. Date utilities consolidated in `src/lib/date-utils.ts`. Team color helpers consolidated in `src/lib/utils.ts`. FairBet math lives exclusively in `src/lib/fairbet-utils.ts`.

---

## Summary

The codebase is in good shape. Key changes this pass:

1. Removed `impliedProbFromAmerican` (unused wrapper function)
2. Fixed Stripe v22 type error in webhook route (`current_period_end` → `items.data[0]?.current_period_end`)
3. Fixed TypeScript errors in two test files (complex generic inference → direct type imports)
4. `tsc --noEmit` and `npm run lint` both exit clean

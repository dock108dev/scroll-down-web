# Code Quality Cleanup Report

**Date**: 2026-04-18  
**Branch**: aidlc_1  
**Scope**: `web/src/` — dead code, documentation in code, consistency, file size, duplicate utilities

---

## Dead Code Removed

### Unexported private symbols — `web/src/lib/fairbet-utils.ts`

**`EV_NO_EDGE_THRESHOLD`** — Removed `export`. The constant was exported but had zero external importers; only used internally by `formatEVDollars`. Making it module-private removes it from the public API and avoids confusion.

**`isConfidenceReliable`** — Removed `export`. The function was exported but had zero external importers; only called internally by `isReliablyPositive`. No behavioral change.

No other dead exports, commented-out blocks, or `TODO`/`FIXME`/`HACK` annotations were found. All remaining exports in `lib/`, `hooks/`, `stores/`, and `realtime/` are imported by at least one consumer.

---

## Refactors Made

### 1. Back button deduplication — `web/src/app/game/[id]/page.tsx`

The mobile back button (button element + inline chevron SVG) was written identically three times: once in the loading-state early return, once in the error-state early return, and once in the main render. Extracted to a `const backButton` just before the early-return guards. No behavioral change; the wrapper `<div>` classes remain distinct per render path.

**Before**: ~36 lines of duplicated JSX across three return paths  
**After**: 9-line const + three one-liner `{backButton}` references

### 2. Intermediate variable removal — `web/src/app/game/[id]/sections.ts`

`hasPregamePosts` was computed only to feed `hasBuzz = !!hasPregamePosts`. The two were collapsed into a single declaration:

```typescript
// before
const hasPregamePosts = isAdmin && data.socialPosts?.some(...);
const hasBuzz = !!hasPregamePosts;

// after
const hasBuzz = !!(isAdmin && data.socialPosts?.some(...));
```

The `!!` is retained because `?.some()` can return `undefined` when `socialPosts` is absent.

### 3. Extra blank line — `web/src/components/home/GameRow.tsx`

Removed a stray double blank line (two newlines instead of one) between the `GameRowProps` interface and the `formatHistoryDateTime` function definition (line 21).

---

## Files Over 500 LOC

| File | Lines | Justification |
|------|-------|---------------|
| `src/lib/types.ts` | 679 | Single-source-of-truth for all API response types per CLAUDE.md rule 6. Expected to be large. |
| `src/hooks/useFairBetOdds.ts` | 645 | Orchestrates multi-page concurrent fetch, abort/retry logic, parlay state, filter state, and realtime subscription — all tightly coupled. Splitting would scatter the abort controller and cache invalidation logic. |
| `src/lib/fairbet-utils.ts` | 624 | FairBet domain utilities: formatting, EV classification, selection display, parlay math, bet enrichment. Cohesive domain boundary. If it grows further, extracting `odds-math.ts` for the probability/devig functions is the natural seam. |
| `src/app/game/[id]/page.tsx` | 532 | Game detail page orchestrates ~10 collapsible sections, realtime subscription, reading-position save/restore, and IntersectionObserver for section nav. High inherent complexity. |
| `src/lib/salient-events.ts` | 509 | Full salient-event extraction pipeline for MLB/NBA/NHL/NFL. Sport-specific rule tables belong together. |

None of these files are flagged for follow-up — their size reflects real complexity, not accidental accumulation.

---

## Documentation Issues Found (Not Changed)

**Missing `web/.env.local.example`** — `CLAUDE.md` Dev Setup documents `cp .env.local.example .env.local` but no such file exists in the repo. The required variables are documented in `docs/env-and-config.md`. A `.env.local.example` with commented-out stubs would make the onboarding step functional for new developers.

---

## Consistency Observations

All files follow CLAUDE.md conventions without exception:

- **Naming**: PascalCase components, kebab-case stores/libs, `use` prefix hooks, `SCREAMING_SNAKE_CASE` constants — 100% compliant across all 243 files.
- **Imports**: No `import React` statements (new JSX transform in use throughout). No `any` types or `@ts-ignore`.
- **ESLint disables**: All `eslint-disable` comments have explanatory text. The `react-hooks/exhaustive-deps` suppressions in hooks are intentional and documented (e.g., cache-miss-only deps, day-change recomputes).
- **Config constants**: All magic numbers live in `src/lib/config.ts` as required. No scattered literals found.
- **API access**: No direct calls to `sda.dock108.dev` from client code — all proxied through `src/app/api/`.

---

## Duplicate Utilities

No duplicated logic found. Date utilities are consolidated in `src/lib/date-utils.ts`. Team color helpers are consolidated in `src/lib/utils.ts`. FairBet math lives exclusively in `src/lib/fairbet-utils.ts`. The `sleep()` helper in `useFairBetOdds.ts` is intentionally file-local (abort-signal-aware, not needed elsewhere).

---

## Summary

The codebase is in good shape. Three targeted changes were made (back button dedup, intermediate variable removal, blank line). No dead exports, commented-out code, naming violations, or scattered constants were found. The five files over 500 lines are justified by inherent domain complexity.

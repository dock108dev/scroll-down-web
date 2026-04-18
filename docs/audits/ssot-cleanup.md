# SSOT Cleanup Audit — 2026-04-18

## Diff-Driven Deletion Summary

### 1. `FEATURES.SOCIAL_ADMIN_ONLY` feature flag removed
**Files**: `web/src/lib/config.ts`, `web/src/app/game/[id]/page.tsx`, `web/src/components/game/WrapUpSection.tsx`

`FEATURES.SOCIAL_ADMIN_ONLY` was hardcoded `true`, making the `false` branch (`": true"` — everyone is admin) permanently dead. All consumers used the pattern:
```ts
const isAdmin = FEATURES.SOCIAL_ADMIN_ONLY ? role === "admin" : true;
```
This simplifies to `const isAdmin = role === "admin"`. The `FEATURES` export and its import were removed from both consumers.

### 2. `TeamStatsComparison` legacy fallback path removed
**File**: `web/src/components/game/TeamStatsComparison.tsx`

The component maintained two rendering paths: a `normalizedGroups` path (from `normalizedStats` API field) and a `legacyActiveGroups` path (from `getGroupsForSport()` + hardcoded aliases). The legacy path was explicitly labeled `{/* Stat groups — legacy fallback path */}` and only activated when `normalizedStats` was absent — an older API format.

Deleted: `useNormalized` gate, `legacyActiveGroups` variable, legacy JSX block, and the now-unused `getGroupsForSport` / `resolveStatValue` imports. `buildGroupsFromNormalized` is now called unconditionally (returns empty array when both `normalizedStats` arrays are empty — no behavior change).

### 3. `PlayerStatsTable` duplicate `R-YDS` column label fixed
**File**: `web/src/components/game/PlayerStatsTable.tsx`

`NFL_COLUMNS` had two entries with label `"R-YDS"` — one for rushing yards and one for receiving yards. The second entry was effectively dead: `detectActiveColumns` would register both, but rendering with `key={col.label}` would produce React key collisions and the second column would be shadowed. The receiving yards entry was renamed to `"REC-YDS"`.

### 4. `reveal` store v0 migration shim removed
**File**: `web/src/stores/reveal.ts`

The store's `migrate` callback handled the v0→v1 migration (renaming `readGameIds: number[]` to `revealedIds: Set<number>`). The store has been at `version: 1` for the lifetime of the project. Any user who has ever loaded the app is already on v1. The entire `migrate` option was removed; Zustand will reset state to default for any hypothetical v0 user (acceptable under the no-backward-compatibility rule).

### 5. `OddsSection` unused `leagueCode` prop removed
**File**: `web/src/components/game/OddsSection.tsx`

`leagueCode?: string` was declared in `OddsSectionProps` but never destructured or referenced in the component body. Removed from the interface. (The prop was also never passed by the call site in `page.tsx`.)

### 6. Stale `"Loading bets..."` test selectors removed
**File**: `web/tests/fairbet/odds.spec.ts`

Two test cases used `page.getByText("Loading bets...")` as a skip condition. That text string does not exist in production code (the actual loading UI says `"Fetching odds from sportsbooks…"`), so `isVisible()` always returned `false` and the skip branch never fired.

- **"loading state appears then resolves"**: The dead skip guard was removed. A timeout now correctly throws (the intended behavior).
- **"bet cards render after loading or empty state shown"**: The `loadingText` variable and its dead `if (stillLoading)` check were removed. The test now skips directly on timeout.

### 7. `STORY_QUALITY_GATE` dead branch removed
**Files**: `web/src/app/game/[id]/sections.ts`, `web/src/app/game/[id]/page.tsx`

`STORY_QUALITY_GATE` is hardcoded `true` in `config.ts`, making `!STORY_QUALITY_GATE` permanently `false`. The "AI Story" section was never pushed onto the sections list, so `sections.includes("AI Story")` in `page.tsx` was always false.

Deleted:
- `import { STORY_QUALITY_GATE }` from `sections.ts`
- `if (!STORY_QUALITY_GATE) s.push("AI Story");` from `sections.ts`
- `case "AI Story":` dead fall-through in `getDefaultExpanded`
- The entire `{/* AI Story */}` `CollapsibleSection` block from `page.tsx` (lines 507–517)
- `import { GameStorySection }` from `page.tsx` (import had no remaining consumer)

The underlying `GameStorySection.tsx` component, `api/ai/*` routes, and story utility libs are retained — they represent in-development infrastructure, not legacy code.

---

## SSOT Verification

| Domain | Authoritative Module |
|--------|---------------------|
| Social content visibility | `role === "admin"` inline (no flag) |
| Team stats rendering | `normalizedStats` from API via `buildGroupsFromNormalized` |
| NFL player stats columns | `NFL_COLUMNS` in `PlayerStatsTable.tsx` (labels now unique) |
| Reveal state persistence | `stores/reveal.ts` at version 1 |
| Odds section props | `OddsSectionProps` (leagueCode removed) |
| Game detail sections | `getSections()` in `sections.ts` — "AI Story" removed, "Game Story" is the flow section |

---

## Risk Log

### `FlowContainer` dual-path extraction — intentionally retained
**File**: `web/src/components/game/FlowContainer.tsx` (line 151)

```ts
const blocks = data?.flow?.blocks ?? data?.blocks;
const moments = data?.flow?.moments ?? data?.moments;
```

`GameFlowResponse` in `types.ts` defines both `flow?: { blocks, moments }` (nested) and top-level `blocks?` / `moments?`. Which format the backend currently sends cannot be determined from source alone. Both paths were retained to avoid a silent production break. **Action needed**: confirm with API team which shape is current, then delete the fallback path and its type fields.

### `pinned-games` store v0/v1 migration — intentionally retained
**File**: `web/src/stores/pinned-games.ts`

The `version < 2` migration block (adds empty `pinMeta`, removes legacy `displayData` field) is still reachable for users upgrading from v0/v1. Unlike `reveal.ts`, this migration does meaningful field transformation (`pinnedIds` array → Set, new `pinMeta` Map). Retained.

---

## Sanity Check

Verified no remaining references to deleted symbols:

```
FEATURES.SOCIAL_ADMIN_ONLY  → 0 references (grep clean)
getGroupsForSport            → 0 references in TeamStatsComparison
resolveStatValue             → 0 references in TeamStatsComparison
legacyActiveGroups           → 0 references
"Loading bets..."            → 0 references in tests
STORY_QUALITY_GATE           → 0 references in game/[id]/ (only in GameStorySection.tsx, intentional)
"AI Story"                   → 0 references in game/[id]/
GameStorySection import      → 0 references in page.tsx
```

`npm run lint` passes with 0 errors, 0 warnings after all changes.

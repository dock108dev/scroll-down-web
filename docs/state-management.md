# State Management

The app has three Zustand stores. All persist to `localStorage` via `persist` middleware. There is no in-memory-only store, no preference sync, no auth store, no realtime sequence state. Everything else (server-fetched game data, catch-up cards) lives in component-local state inside the data hooks.

## Stores

### `useSettings` — `sd-settings`, version 2

File: `web/src/stores/settings.ts`.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `theme` | `"system" \| "light" \| "dark"` | `DEFAULTS.THEME` (`"system"`) | Applied by `ThemeProvider` |
| `showStaleBanners` | `boolean` | `true` | Controls whether degraded-state banners are shown to the user |

Actions: `setTheme`, `setShowStaleBanners`.

The v1→v2 migration (in the same file) deletes legacy fields from a previous product surface: `scoreRevealMode`, `scoreHideLeagues`, `scoreHideTeams`, `timelineDefaultTiers`, `followingLive`, `followingLiveAt`, `autoResumePosition`, `preferredSportsbook`, `oddsFormat`, `hideLimitedData`, `homeExpandedSections`. Any of these in a returning user's `localStorage` are dropped on first load.

### `useOnboarding` — `sd-onboarding`, version 1

File: `web/src/stores/onboarding.ts`.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `onboarded` | `boolean` | `false` | Becomes `true` after the user picks a team or skips |
| `favoriteTeam` | `string \| null` | `null` | 3-letter MLB abbreviation or `null` if user skipped |

Actions: `setFavoriteTeam(abbr)` (validates against `findMlbTeam` in `lib/mlb-teams.ts`), `skipOnboarding`, `clearFavoriteTeam`, `resetOnboarding`.

`FirstVisitGate` (in `components/onboarding/`) reads `onboarded` and renders `TeamPickerOverlay` over the home page until it flips. The favorite team is currently used by `FirstVisitGate` only — it does not change feed ordering or filtering.

### `useCatchupProgress` — `sd-catchup-state`, version 1

File: `web/src/stores/catchup-progress.ts`.

```typescript
interface CatchupEntry {
  cardIndex: number;            // index into the rendered deck (0 = scene-setter)
  completed: boolean;            // user tapped through the FinalReveal
  lastSeenPlayIndex: number;     // last play index the client knew about
  updatedAt: number;             // ms epoch
}

state.entries: Record<number /* gameId */, CatchupEntry>;
```

Actions:

- `getEntry(gameId)` — read accessor
- `setProgress(gameId, cardIndex, lastSeenPlayIndex)` — used by `CatchupExperience` while the user scrolls
- `markCompleted(gameId)` — flipped by `FinalReveal`
- `clearAll()`

`pruneEntries()` runs on every write: it drops entries older than `STORAGE.CATCHUP_MAX_AGE_DAYS` (60d) and caps total entries at `STORAGE.MAX_CATCHUP_ENTRIES` (200), keeping the most recently updated.

`lastSeenPlayIndex` is what gets passed back to `/api/games/[gameId]/cards?since=<n>` on the next live poll, so the upstream/proxy can return only new cards when the game has progressed.

## What is **not** in a store

- **Game list and catch-up cards** — fetched by `useGamesList` and `useCatchupCards` in `web/src/hooks/`, held in component-local state. There is no normalized game cache, no list-key map, no "in-flight" tracking outside `apiFetch`'s `inflight` map.
- **Health status** — `useHealthStatus` exposes a module-level boolean via `useSyncExternalStore`. Not a Zustand store.
- **Theme application** — `ThemeProvider` reads `useSettings.theme` and toggles `<html class="dark">`; the class itself is DOM state, not persisted by Zustand.
- **Scroll position / IntersectionObserver state** — kept inside the catch-up scroll container; resetting on navigation is intentional.

## Storage keys

All keys are constants in `STORAGE_KEYS` in `web/src/lib/config.ts`:

| Constant | Key |
|----------|-----|
| `STORAGE_KEYS.SETTINGS` | `sd-settings` |
| `STORAGE_KEYS.ONBOARDING` | `sd-onboarding` |
| `STORAGE_KEYS.CATCHUP_STATE` | `sd-catchup-state` |
| `STORAGE_KEYS.PWA_INSTALL_DISMISSED` | `sd-pwa-install-dismissed` |
| `STORAGE_KEYS.PWA_SESSION_COUNT` | `sd-pwa-session-count` |
| `STORAGE_KEYS.ANON_ID` | `sd-anon-id` |

The two `PWA_*` keys are read/written directly by `PWAInstallPrompt` (not via a store). `ANON_ID` is reserved but not currently consumed.

## Migration policy

When changing a store's persisted shape:

1. Increment `version` in the `persist` config.
2. Add a `migrate(persisted, fromVersion)` that drops removed fields, normalizes types, and provides defaults for new fields.
3. Avoid silent shape drift — if a field was deleted from the type, explicitly `delete` it in `migrate` so old `localStorage` entries don't ship stale junk to the rest of the app.

`web/src/stores/settings.ts:27-46` is the canonical example.

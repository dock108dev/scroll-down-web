# State Management

## Overview

All client-side state is managed by Zustand stores. Most stores persist to localStorage for offline resilience and cross-session continuity. For authenticated users, a subset of state syncs to the backend server.

## Stores

### `auth` (persisted: `sd-auth`)

Authentication state. Holds JWT token, user role, email, and userId.

- `login(email, password)` — POST to `/api/auth/login`, stores token, triggers preference sync
- `signup(email, password)` — POST to `/api/auth/signup`
- `refreshMe()` — validates stored token via `GET /api/auth/me`; auto-logouts on 401
- `logout()` — clears token, stops preference sync

### `game-data` (not persisted)

Canonical store for all game data. In-memory only — rebuilt from API on each session.

- Normalized: `Map<gameId, { core, detail, flow, timestamps }>`
- List tracking: `Map<listKey, { fetchedAt, gameIds }>`
- Realtime state: per-channel sequence numbers, desync flags
- Mutations: `upsertFromList`, `upsertFromDetail`, `applyGamePatch`, `appendPbp`
- Selectors: `getCore(id)`, `getDetail(id)`, `getFlow(id)` return stable references

### `settings` (persisted: `sd-settings`)

User preferences. All settings have sensible defaults and work without auth.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | `"system" \| "light" \| "dark"` | `"system"` | Color theme |
| `scoreRevealMode` | `"onMarkRead" \| "always"` | `"onMarkRead"` | Whether scores are hidden until revealed |
| `oddsFormat` | `"american" \| "decimal" \| "fractional"` | `"american"` | Odds display format |
| `preferredSportsbook` | `string` | `""` | Highlight a specific book in odds displays |
| `autoResumePosition` | `boolean` | `true` | Scroll to last play on game detail revisit |
| `homeExpandedSections` | `string[]` | `[]` | Which date sections are expanded on home |
| `hideLimitedData` | `boolean` | `true` | Hide thin-market odds |
| `timelineDefaultTiers` | `number[]` | `[1, 2, 3]` | Which play tiers to show in timeline |
| `followingLive` | `boolean` | `false` | Following Live mode (continuous score updates) |
| `followingLiveAt` | `number` | `0` | Timestamp when Following Live was activated |

### `reveal` (persisted: `sd-read-state`)

Tracks which games the user has "read" (revealed scores for).

- `revealedIds: Set<number>` — game IDs the user has revealed (max 500)
- `snapshots: Map<number, Snapshot>` — score snapshot at reveal time (max 20)
- Batch operations: `revealBatch()`, `hideBatch()` for bulk actions
- Snapshots detect "new data" — if live score differs from snapshot, show UPDATE indicator

### `pinned-games` (persisted: `sd-pinned-games`)

- `pinnedIds: Set<number>` — max 10 pinned games
- `pinMeta: Map<number, { away, home abbreviations }>` — for chip display
- Auto-prune: removes pins for games no longer in current date range

### `reading-position` (persisted: `sd-reading-position`)

Per-game scroll position tracking for timeline resume.

- Stores: play index, period, clock, total plays, timestamp
- Auto-prune: entries older than 30 days, capped at 50 entries
- Resume: scrolls to saved play after 300ms render delay

### `section-layout` (persisted: `sd-section-layout`)

Per-game section expansion state (which collapsible sections are open/closed). Capped at 50 entries.

### `home-scroll` (not persisted)

Saves home page scroll Y position for restoration on back navigation. In-memory only — resets on page reload.

### `ui` (not persisted)

Transient UI state: `settingsOpen` boolean for the settings drawer.

## Preference Sync

For authenticated users, preferences sync bidirectionally with the server via `src/lib/preferences-sync.ts`.

### What syncs

- All settings (theme, score reveal mode, odds format, etc.)
- Pinned game IDs
- Revealed game IDs

### What does not sync

- Score snapshots (display-only cache, rebuilt locally)
- Reading positions (too granular for server sync)
- Section layouts (too granular for server sync)
- Home scroll position (transient)

### Sync flow

1. **On login**: `pullAndStartSync()` fetches server preferences, hydrates local stores
2. **On change**: any settings/pins/reveals change triggers a debounced push (2s delay)
3. **On logout**: sync stops; localStorage retained for guest browsing
4. **On tab close**: `flushPreferences()` with `keepalive: true` for best-effort final push

### Conflict resolution

Server is authoritative for pinned IDs and revealed IDs. On pull, local state is replaced (not merged). Settings are hydrated field-by-field from server (non-null values win).
